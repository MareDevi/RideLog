import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import {
  type Coordinate,
  type RideActivity,
  rideActivitySchema,
} from "../../src/lib/ridelog-schema"
import { decodeKeepPayload, sha256 } from "../lib/crypto"
import { ensureDir, writeJsonFile } from "../lib/fs"
import { boundsForCoordinates, gcj02ToWgs84 } from "../lib/geo"
import {
  type RoutePoint,
  type StagedActivity,
  stagedActivitySchema,
} from "../lib/types"

const LOGIN_API = "https://api.gotokeep.com/v1.1/users/login"
const RUN_DATA_API =
  "https://api.gotokeep.com/pd/v3/stats/detail?dateUnit=all&type=cycling&lastDate="
const RUN_LOG_API = "https://api.gotokeep.com/pd/v3/cyclinglog/"
const USER_AGENT = "RideLog/0.1 (+https://github.com/local/ridelog)"
const STAGING_DIR = "data/private/staging"

const keepListResponseSchema = z.object({
  data: z.object({
    lastTimestamp: z.number().nullable().optional(),
    records: z.array(
      z.object({
        logs: z.array(
          z.object({
            stats: z
              .object({
                id: z.string(),
                isDoubtful: z.boolean().optional(),
              })
              .nullable()
              .optional(),
          })
        ),
      })
    ),
  }),
})

const keepLogResponseSchema = z.object({
  data: z
    .object({
      id: z.string(),
      dataType: z.string().optional(),
      name: z.unknown().optional(),
      startTime: z.number(),
      endTime: z.number().optional(),
      timezone: z.unknown().optional(),
      duration: z.number().optional(),
      distance: z.number().optional(),
      calorie: z.number().optional(),
      calories: z.number().optional(),
      geoPoints: z.string().nullable().optional(),
      region: z.unknown().optional(),
      city: z.unknown().optional(),
      maxSpeed: z.number().optional(),
    })
    .passthrough(),
})

const keepGeoPointSchema = z
  .object({
    longitude: z.number(),
    latitude: z.number(),
    altitude: z.number().optional(),
    timestamp: z.number().optional(),
    unixTimestamp: z.number().optional(),
  })
  .passthrough()

export type KeepImportOptions = {
  dryRun: boolean
  since?: string
}

export async function runKeepImport(options: KeepImportOptions) {
  const mobile = requireEnv("KEEP_MOBILE")
  const password = requireEnv("KEEP_PASSWORD")
  const headers = await login(mobile, password)
  const ids = await listCyclingIds(headers, options.since)
  const imported: string[] = []
  const skipped: Array<{ id: string; reason: string }> = []

  await ensureDir(STAGING_DIR)

  for (const id of ids) {
    const payload = await fetchKeepActivity(id, headers)
    if (!payload) {
      skipped.push({ id, reason: "detail not found" })
      continue
    }
    const staged = normalizeKeepLogSafely(payload, id, new Date().toISOString())
    if (!staged) {
      skipped.push({ id, reason: "not importable" })
      continue
    }
    if (!options.dryRun) {
      await writeJsonFile(
        join(STAGING_DIR, `${staged.id}.json`),
        stagedActivitySchema.parse(staged)
      )
      await writeFile(
        join(STAGING_DIR, `${staged.id}.raw.json`),
        `${JSON.stringify(payload, null, 2)}\n`,
        {
          mode: 0o600,
        }
      )
    }
    imported.push(staged.id)
  }

  console.log(
    `${options.dryRun ? "Dry run found" : "Imported"} ${imported.length} Keep cycling activities`
  )
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} Keep activities with unavailable or unsupported details`
    )
    debugLog(
      `Skipped details: ${skipped
        .slice(0, 10)
        .map((entry) => `${maskId(entry.id)}:${entry.reason}`)
        .join(", ")}`
    )
  }
  return imported
}

function normalizeKeepLogSafely(
  payload: unknown,
  listId: string,
  importedAt: string
) {
  try {
    return normalizeKeepLog(payload, importedAt)
  } catch (error) {
    if (error instanceof z.ZodError) {
      debugLog(
        `Invalid Keep detail ${maskId(listId)}: ${error.issues
          .map(
            (issue) => `${issue.path.join(".") || "<root>"} ${issue.message}`
          )
          .join("; ")}`
      )
      return null
    }
    throw error
  }
}

export function normalizeKeepLog(
  payload: unknown,
  importedAt: string
): StagedActivity | null {
  const parsed = keepLogResponseSchema.parse(payload).data
  if (parsed.dataType && parsed.dataType !== "outdoorCycling") {
    return null
  }
  if (!parsed.duration || parsed.duration <= 0) {
    return null
  }

  const sourceActivityId = extractKeepId(parsed.id)
  const id = `keep_${sanitizeId(sourceActivityId)}`
  const startTime = new Date(parsed.startTime).toISOString()
  const endTime = parsed.endTime
    ? new Date(parsed.endTime).toISOString()
    : undefined
  const points = parsed.geoPoints
    ? decodeKeepRoute(parsed.geoPoints, parsed.startTime)
    : []
  const coordinates: Coordinate[] = points.map((point) => [
    point.longitude,
    point.latitude,
  ])
  const routeChecksum =
    coordinates.length > 0 ? sha256(JSON.stringify(coordinates)) : undefined
  const sourceChecksum = sha256(JSON.stringify(payload))

  const activity: RideActivity = {
    id,
    type: "cycling",
    title: stringifyKeepValue(parsed.name) || "Ride from Keep",
    startTime,
    endTime,
    timezone: stringifyKeepValue(parsed.timezone),
    distanceMeters: parsed.distance ?? 0,
    movingTimeSeconds: parsed.duration,
    elapsedTimeSeconds: parsed.endTime
      ? Math.max(0, Math.round((parsed.endTime - parsed.startTime) / 1000))
      : parsed.duration,
    averageSpeedMps:
      parsed.distance && parsed.duration
        ? parsed.distance / parsed.duration
        : undefined,
    maxSpeedMps: parsed.maxSpeed,
    calories: parsed.calorie ?? parsed.calories,
    route:
      coordinates.length >= 2
        ? {
            id,
            format: "geojson",
            href: `data/routes/${id}.geojson`,
            pointCount: coordinates.length,
            bounds: boundsForCoordinates(coordinates),
            start: coordinates.at(0),
            end: coordinates.at(-1),
            isPrivate: true,
          }
        : undefined,
    location:
      parsed.city || parsed.region
        ? {
            name: stringifyKeepValue(parsed.city),
            region: stringifyKeepValue(parsed.region),
          }
        : undefined,
    source: {
      provider: "keep",
      activityId: sourceActivityId,
      importedAt,
      checksum: sourceChecksum,
    },
    privacy: {
      visibility: "public",
      hideRoute: false,
    },
    createdAt: startTime,
    updatedAt: importedAt,
  }

  return stagedActivitySchema.parse({
    ...rideActivitySchema.parse(activity),
    privateRoute:
      points.length >= 2
        ? {
            points,
            coordinates,
            sourceChecksum,
            routeChecksum,
          }
        : undefined,
  })
}

export function decodeKeepRoute(
  geoPoints: string,
  startTimeMs: number
): RoutePoint[] {
  const rawPoints = z
    .array(keepGeoPointSchema)
    .parse(decodeKeepPayload(geoPoints, true))
  const firstTimestamp = rawPoints.at(0)?.timestamp
  const absoluteTimestamps =
    firstTimestamp !== undefined && firstTimestamp > 3_600_000

  return rawPoints.map((point) => {
    const [longitude, latitude] = gcj02ToWgs84(point.latitude, point.longitude)
    const timestamp = point.timestamp ?? point.unixTimestamp
    const seconds =
      timestamp === undefined
        ? undefined
        : absoluteTimestamps
          ? Math.round(timestamp / 10)
          : Math.round(startTimeMs / 1000 + timestamp / 10)

    return {
      longitude,
      latitude,
      altitude: point.altitude,
      timestamp,
      time:
        seconds === undefined
          ? undefined
          : new Date(seconds * 1000).toISOString(),
    }
  })
}

async function login(mobile: string, password: string) {
  const response = await fetch(LOGIN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ mobile, password }),
  })
  if (!response.ok) {
    throw new Error(`Keep login failed with HTTP ${response.status}`)
  }
  const payload = z
    .object({ data: z.object({ token: z.string() }) })
    .parse(await response.json())
  return {
    Authorization: `Bearer ${payload.data.token}`,
    "User-Agent": USER_AGENT,
  }
}

async function listCyclingIds(
  headers: Record<string, string>,
  since: string | undefined
) {
  const sinceMs = since ? Date.parse(since) : undefined
  const ids: string[] = []
  let lastDate = 0

  do {
    const payload = keepListResponseSchema.parse(
      await fetchJson(`${RUN_DATA_API}${lastDate}`, headers)
    )
    ids.push(...extractCyclingIdsFromListResponse(payload))
    lastDate = payload.data.lastTimestamp ?? 0
  } while (lastDate && (!sinceMs || lastDate >= sinceMs))

  return ids
}

export function extractCyclingIdsFromListResponse(
  payload: z.infer<typeof keepListResponseSchema>
) {
  const ids: string[] = []
  for (const record of payload.data.records) {
    for (const log of record.logs) {
      if (log.stats && !log.stats.isDoubtful) {
        ids.push(log.stats.id)
      }
    }
  }
  return ids
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new KeepHttpError(
      response.status,
      `Keep request failed with HTTP ${response.status}`
    )
  }
  return response.json()
}

async function fetchKeepActivity(id: string, headers: Record<string, string>) {
  try {
    return await fetchJson(`${RUN_LOG_API}${encodeURIComponent(id)}`, headers)
  } catch (error) {
    if (error instanceof KeepHttpError && error.status === 404) {
      return null
    }
    throw error
  }
}

class KeepHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "KeepHttpError"
    this.status = status
  }
}

function extractKeepId(id: string) {
  return id.split("_")[1] || id
}

function sanitizeId(id: string) {
  return id.replaceAll(/[^a-zA-Z0-9_-]/g, "_")
}

function stringifyKeepValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === "string") {
    return value || undefined
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>
    for (const key of ["name", "city", "province", "country", "label"]) {
      const nested = stringifyKeepValue(candidate[key])
      if (nested) {
        return nested
      }
    }
    return JSON.stringify(value)
  }
  return undefined
}

function debugLog(message: string) {
  if (process.env.RIDELOG_KEEP_DEBUG === "1") {
    console.log(`[keep-debug] ${message}`)
  }
}

function maskId(id: string) {
  if (id.length <= 10) {
    return id
  }
  return `${id.slice(0, 6)}...${id.slice(-4)}`
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}
