import type {
  RideActivity,
  RideRouteSummary,
} from "../../src/lib/ridelog-schema"
import { boundsForCoordinates, coordinatesFromPoints, trimRoute } from "./geo"
import type { RoutePoint, StagedActivity } from "./types"

export type PrivacyConfig = {
  hideRoutes: boolean
  trimStartMeters: number
  trimEndMeters: number
}

export function privacyConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PrivacyConfig {
  return {
    hideRoutes: parseBoolean(env.RIDELOG_HIDE_ROUTES),
    trimStartMeters: parseNonnegativeNumber(
      env.RIDELOG_PRIVACY_TRIM_START_METERS
    ),
    trimEndMeters: parseNonnegativeNumber(env.RIDELOG_PRIVACY_TRIM_END_METERS),
  }
}

export function applyRoutePrivacy(
  activity: StagedActivity,
  config: PrivacyConfig,
  now: string
): { activity: RideActivity; points: RoutePoint[] } {
  const privateRoute = activity.privateRoute
  const privacy = {
    ...activity.privacy,
    hideRoute: config.hideRoutes || activity.privacy.hideRoute,
    trimStartMeters: config.trimStartMeters || activity.privacy.trimStartMeters,
    trimEndMeters: config.trimEndMeters || activity.privacy.trimEndMeters,
    appliedAt: now,
  }

  if (!privateRoute || privacy.hideRoute) {
    const {
      route: _route,
      privateRoute: _privateRoute,
      ...withoutRoute
    } = activity
    return {
      activity: { ...withoutRoute, privacy },
      points: [] as RoutePoint[],
    }
  }

  const points = trimRoute(
    privateRoute.points,
    privacy.trimStartMeters ?? 0,
    privacy.trimEndMeters ?? 0
  )
  if (points.length < 2) {
    const {
      route: _route,
      privateRoute: _privateRoute,
      ...withoutRoute
    } = activity
    return {
      activity: { ...withoutRoute, privacy: { ...privacy, hideRoute: true } },
      points: [] as RoutePoint[],
    }
  }

  const coordinates = coordinatesFromPoints(points)
  const route: RideRouteSummary = {
    id: activity.id,
    format: "geojson",
    href: `data/routes/${activity.id}.geojson`,
    pointCount: coordinates.length,
    bounds: boundsForCoordinates(coordinates),
    start: coordinates.at(0),
    end: coordinates.at(-1),
    isPrivate: false,
  }
  const { privateRoute: _privateRoute, ...publicActivity } = activity
  return { activity: { ...publicActivity, route, privacy }, points }
}

function parseBoolean(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true"
}

function parseNonnegativeNumber(value: string | undefined) {
  if (!value) {
    return 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}
