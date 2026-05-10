import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout } from "node:timers/promises"
import { readJsonFile, writeJsonFile } from "./lib/fs"
import { buildGpx } from "./lib/gpx"
import { applyRoutePrivacy, privacyConfigFromEnv } from "./lib/privacy"
import {
  type StagedActivity,
  stagedActivitySchema,
  syncStateSchema,
} from "./lib/types"

const STATE_FILE = "data/private/sync-state.json"
const STAGING_DIR = "data/private/staging"

type StravaTokenResponse = {
  access_token: string
  refresh_token?: string
  scope?: string
}

type StravaUploadResponse = {
  id: number
  activity_id?: number | null
  error?: string | null
  status?: string
}

class StravaDuplicateActivityError extends Error {
  readonly activityId: string

  constructor(activityId: string, message: string) {
    super(message)
    this.name = "StravaDuplicateActivityError"
    this.activityId = activityId
  }
}

export async function runStravaSync(dryRun: boolean) {
  const stagedActivities = await readStagedActivities()
  const state = await readJsonFile(STATE_FILE, syncStateSchema, {
    version: 1,
    activities: {},
  })
  const privacy = privacyConfigFromEnv()
  const now = new Date().toISOString()
  const accessToken = dryRun ? undefined : await refreshStravaToken()
  let uploaded = 0
  let skipped = 0

  for (const staged of stagedActivities) {
    const key = `keep:${staged.source.activityId}`
    const stateEntry = state.activities[key]
    const routeChecksum = staged.privateRoute?.routeChecksum
    if (
      stateEntry?.stravaActivityId &&
      stateEntry.sourceChecksum === staged.source.checksum &&
      stateEntry.routeChecksum === routeChecksum
    ) {
      skipped += 1
      continue
    }

    const transformed = applyRoutePrivacy(staged, privacy, now)
    if (dryRun) {
      console.log(`Dry run would upload ${staged.id} to Strava`)
      skipped += 1
      continue
    }
    if (!accessToken) {
      throw new Error("Unable to refresh Strava token")
    }
    if (transformed.points.length < 2) {
      state.activities[key] = {
        ...stateEntry,
        canonicalId: staged.id,
        sourceChecksum: staged.source.checksum,
        routeChecksum,
        lastError: "No public route points available after privacy processing",
      }
      continue
    }

    const upload = await uploadToStrava(
      accessToken,
      staged,
      buildGpx(transformed.activity, transformed.points)
    )
    try {
      const completed = await pollUpload(accessToken, upload.id)
      if (!completed.activity_id) {
        throw new Error(
          `Strava upload ${upload.id} did not return an activity id`
        )
      }

      state.activities[key] = buildSyncedStateEntry(
        staged,
        routeChecksum,
        String(upload.id),
        String(completed.activity_id)
      )
      uploaded += 1
    } catch (error) {
      if (error instanceof StravaDuplicateActivityError) {
        state.activities[key] = buildSyncedStateEntry(
          staged,
          routeChecksum,
          String(upload.id),
          error.activityId
        )
        console.log(
          `Matched duplicate ${staged.id} to existing Strava activity ${error.activityId}`
        )
        skipped += 1
        continue
      }
      throw error
    }
  }

  if (!dryRun) {
    await writeJsonFile(STATE_FILE, syncStateSchema.parse(state))
  }
  console.log(
    `${dryRun ? "Dry run checked" : "Synced"} ${stagedActivities.length} staged activities (${uploaded} uploaded, ${skipped} skipped)`
  )
}

async function refreshStravaToken() {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      refresh_token: requireEnv("STRAVA_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Strava token refresh failed with HTTP ${response.status}: ${await readSafeResponseText(response)}`
    )
  }
  const payload = (await response.json()) as StravaTokenResponse
  assertActivityWriteScope(payload.scope)
  if (
    payload.refresh_token &&
    payload.refresh_token !== process.env.STRAVA_REFRESH_TOKEN
  ) {
    console.log(
      "Strava returned a new refresh token. Update STRAVA_REFRESH_TOKEN before the next real sync."
    )
  }
  return payload.access_token
}

async function uploadToStrava(
  accessToken: string,
  activity: StagedActivity,
  gpx: string
) {
  const formData = new FormData()
  formData.set("sport_type", "Ride")
  formData.set("data_type", "gpx")
  formData.set("external_id", `${activity.id}.gpx`)
  formData.set("name", activity.title)
  formData.set(
    "file",
    new Blob([gpx], { type: "application/gpx+xml" }),
    `${activity.id}.gpx`
  )

  const response = await fetch("https://www.strava.com/api/v3/uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })
  if (!response.ok) {
    throw new Error(
      `Strava upload failed with HTTP ${response.status}: ${await readSafeResponseText(response)}`
    )
  }
  return (await response.json()) as StravaUploadResponse
}

async function pollUpload(accessToken: string, uploadId: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(
      `https://www.strava.com/api/v3/uploads/${uploadId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (!response.ok) {
      throw new Error(
        `Strava upload status failed with HTTP ${response.status}: ${await readSafeResponseText(response)}`
      )
    }
    const upload = (await response.json()) as StravaUploadResponse
    if (upload.error) {
      const duplicateActivityId = extractDuplicateActivityId(upload.error)
      if (duplicateActivityId) {
        throw new StravaDuplicateActivityError(
          duplicateActivityId,
          upload.error
        )
      }
      throw new Error(`Strava upload failed: ${upload.error}`)
    }
    if (upload.activity_id) {
      return upload
    }
    await setTimeout(3_000)
  }
  throw new Error(`Timed out waiting for Strava upload ${uploadId}`)
}

function buildSyncedStateEntry(
  staged: StagedActivity,
  routeChecksum: string | undefined,
  uploadId: string,
  activityId: string
) {
  return {
    canonicalId: staged.id,
    sourceChecksum: staged.source.checksum,
    routeChecksum,
    stravaUploadId: uploadId,
    stravaActivityId: activityId,
    stravaUrl: `https://www.strava.com/activities/${activityId}`,
    lastImportedAt: staged.source.importedAt,
    lastSyncedAt: new Date().toISOString(),
  }
}

export function extractDuplicateActivityId(error: string) {
  const match = error.match(/\/activities\/(\d+)/)
  return match?.[1]
}

async function readStagedActivities(): Promise<StagedActivity[]> {
  try {
    const files = (await readdir(STAGING_DIR))
      .filter((file) => file.endsWith(".json") && !file.endsWith(".raw.json"))
      .sort()
    const activities = []
    for (const file of files) {
      activities.push(
        stagedActivitySchema.parse(
          JSON.parse(await readFile(join(STAGING_DIR, file), "utf8"))
        )
      )
    }
    return activities
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export function assertActivityWriteScope(scope: string | undefined) {
  if (!scope) {
    return
  }
  const scopes = new Set(scope.split(/\s+/).filter(Boolean))
  if (!scopes.has("activity:write")) {
    throw new Error(
      `Strava token is missing activity:write scope. Current scopes: ${scope}. Re-authorize the app with activity:write and update STRAVA_REFRESH_TOKEN.`
    )
  }
}

async function readSafeResponseText(response: Response) {
  const text = await response.text()
  return sanitizeResponseText(text).slice(0, 800) || "<empty response body>"
}

function sanitizeResponseText(text: string) {
  return text
    .replaceAll(/access_token["'=:\s]+[^"',\s}]+/gi, "access_token:<redacted>")
    .replaceAll(
      /refresh_token["'=:\s]+[^"',\s}]+/gi,
      "refresh_token:<redacted>"
    )
    .replaceAll(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>")
    .replaceAll(/\s+/g, " ")
    .trim()
}

if (import.meta.main) {
  await runStravaSync(process.argv.includes("--dry-run"))
}
