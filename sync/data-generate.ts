import { readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  activitiesFileSchema,
  type RideActivity,
  summarySchema,
} from "../src/lib/ridelog-schema"
import { ensureDir, readJsonFile, writeJsonFile } from "./lib/fs"
import { coordinatesFromPoints } from "./lib/geo"
import {
  applyRoutePrivacy,
  type PrivacyConfig,
  privacyConfigFromEnv,
} from "./lib/privacy"
import {
  type StagedActivity,
  type SyncState,
  stagedActivitySchema,
  syncStateSchema,
} from "./lib/types"

const STAGING_DIR = "data/private/staging"
const STATE_FILE = "data/private/sync-state.json"
const PUBLIC_DATA_DIR = "public/data"
const ROUTES_DIR = "public/data/routes"

export async function generatePublicData() {
  const stagedActivities = await readStagedActivities()
  const state = await readJsonFile(STATE_FILE, syncStateSchema, {
    version: 1,
    activities: {},
  })
  const privacy = privacyConfigFromEnv()
  const now = new Date().toISOString()
  const publicActivities: RideActivity[] = []
  const routeFiles: Array<{ id: string; data: unknown }> = []
  const overlayFeatures: Array<{
    startTime: string
    feature: GeoJSON.Feature<GeoJSON.LineString>
  }> = []

  for (const staged of stagedActivities) {
    const stateEntry = state.activities[`keep:${staged.source.activityId}`]
    const withDestination =
      stateEntry?.stravaActivityId && stateEntry.lastSyncedAt
        ? {
            ...staged,
            destinations: [
              ...(staged.destinations ?? []),
              {
                provider: "strava",
                activityId: stateEntry.stravaActivityId,
                url: stateEntry.stravaUrl,
                syncedAt: stateEntry.lastSyncedAt,
              },
            ],
          }
        : staged
    const transformed = applyRoutePrivacy(withDestination, privacy, now)
    publicActivities.push(transformed.activity)

    if (transformed.points.length > 0) {
      const coordinates = coordinatesFromPoints(transformed.points)
      const feature: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {
          activityId: staged.id,
          title: staged.title,
          year: new Date(staged.startTime).getUTCFullYear(),
          color: "#ef4444",
        },
        geometry: {
          type: "LineString",
          coordinates,
        },
      }
      routeFiles.push({
        id: staged.id,
        data: feature,
      })
      overlayFeatures.push({ startTime: staged.startTime, feature })
    }
  }

  publicActivities.sort((left, right) =>
    right.startTime.localeCompare(left.startTime)
  )

  const activitiesFile = activitiesFileSchema.parse({
    version: 1,
    activities: publicActivities,
  })
  const summary = summarySchema.parse(
    buildSummary(publicActivities, privacy, state, now)
  )

  await rm(ROUTES_DIR, { recursive: true, force: true })
  await ensureDir(ROUTES_DIR)
  for (const route of routeFiles) {
    await writeJsonFile(join(ROUTES_DIR, `${route.id}.geojson`), route.data)
  }
  await writeJsonFile(join(PUBLIC_DATA_DIR, "activities.json"), activitiesFile)
  await writeJsonFile(join(PUBLIC_DATA_DIR, "summary.json"), summary)

  overlayFeatures.sort((left, right) =>
    left.startTime.localeCompare(right.startTime)
  )
  const allRoutesGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: "FeatureCollection",
    features: overlayFeatures.map((item) => item.feature),
  }
  await writeJsonFile(
    join(PUBLIC_DATA_DIR, "all-routes.geojson"),
    allRoutesGeoJson
  )

  console.log(
    `Generated ${activitiesFile.activities.length} public activities, ${routeFiles.length} route files, and ${overlayFeatures.length} overlay routes`
  )
}

async function readStagedActivities(): Promise<StagedActivity[]> {
  try {
    const files = (await readdir(STAGING_DIR))
      .filter((file) => file.endsWith(".json") && !file.endsWith(".raw.json"))
      .sort()
    const activities = []
    for (const file of files) {
      activities.push(
        await readJsonFile(
          join(STAGING_DIR, file),
          stagedActivitySchema,
          null as never
        )
      )
    }
    return activities
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await ensureDir(PUBLIC_DATA_DIR)
      await ensureDir(ROUTES_DIR)
      await writeFile(join(PUBLIC_DATA_DIR, ".gitkeep"), "")
      return []
    }
    throw error
  }
}

function buildSummary(
  activities: RideActivity[],
  privacy: PrivacyConfig,
  state: SyncState,
  now: string
) {
  const years = new Map<
    number,
    {
      year: number
      rides: number
      distanceMeters: number
      movingTimeSeconds: number
      elevationGainMeters: number
    }
  >()

  for (const activity of activities) {
    const year = new Date(activity.startTime).getUTCFullYear()
    const entry = years.get(year) ?? {
      year,
      rides: 0,
      distanceMeters: 0,
      movingTimeSeconds: 0,
      elevationGainMeters: 0,
    }
    entry.rides += 1
    entry.distanceMeters += activity.distanceMeters
    entry.movingTimeSeconds += activity.movingTimeSeconds ?? 0
    entry.elevationGainMeters += activity.elevationGainMeters ?? 0
    years.set(year, entry)
  }

  const yearList = [...years.values()].sort(
    (left, right) => right.year - left.year
  )
  const stateEntries = Object.values(state.activities)

  return {
    version: 1,
    generatedAt: now,
    totals: yearList.reduce(
      (total, year) => ({
        rides: total.rides + year.rides,
        distanceMeters: total.distanceMeters + year.distanceMeters,
        movingTimeSeconds: total.movingTimeSeconds + year.movingTimeSeconds,
        elevationGainMeters:
          total.elevationGainMeters + year.elevationGainMeters,
      }),
      {
        rides: 0,
        distanceMeters: 0,
        movingTimeSeconds: 0,
        elevationGainMeters: 0,
      }
    ),
    years: yearList,
    sync: {
      lastImportedAt: latestDate(
        stateEntries.map((entry) => entry.lastImportedAt)
      ),
      lastSyncedAt: latestDate(stateEntries.map((entry) => entry.lastSyncedAt)),
      source: "keep",
      destination: "strava",
      routePrivacy: {
        hideRoutes: privacy.hideRoutes,
        trimStartMeters: privacy.trimStartMeters,
        trimEndMeters: privacy.trimEndMeters,
      },
    },
  }
}

function latestDate(values: Array<string | undefined>) {
  return values.filter(Boolean).sort().at(-1)
}

if (import.meta.main) {
  await generatePublicData()
}
