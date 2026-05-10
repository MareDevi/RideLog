import { z } from "zod"

export const coordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
])

export const boundsSchema = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
})

export const rideRouteSummarySchema = z.object({
  id: z.string().min(1),
  format: z.enum(["geojson", "gpx", "polyline"]),
  href: z.string().min(1),
  pointCount: z.number().int().nonnegative().optional(),
  bounds: boundsSchema.optional(),
  start: coordinateSchema.optional(),
  end: coordinateSchema.optional(),
  isPrivate: z.boolean(),
})

export const rideLocationSchema = z.object({
  name: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
})

export const rideGearSchema = z.object({
  name: z.string().optional(),
  bikeId: z.string().optional(),
})

export const activitySourceSchema = z.object({
  provider: z.string().min(1),
  activityId: z.string().min(1),
  importedAt: z.string().datetime({ offset: true }),
  checksum: z.string().optional(),
})

export const activityDestinationSchema = z.object({
  provider: z.string().min(1),
  activityId: z.string().min(1),
  url: z.string().url().optional(),
  syncedAt: z.string().datetime({ offset: true }),
})

export const activityPrivacySchema = z.object({
  visibility: z.enum(["public", "private", "unlisted"]),
  hideRoute: z.boolean(),
  trimStartMeters: z.number().nonnegative().optional(),
  trimEndMeters: z.number().nonnegative().optional(),
  appliedAt: z.string().datetime({ offset: true }).optional(),
})

export const rideActivitySchema = z.object({
  id: z.string().min(1),
  type: z.literal("cycling"),
  title: z.string().min(1),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
  distanceMeters: z.number().nonnegative(),
  movingTimeSeconds: z.number().nonnegative().optional(),
  elapsedTimeSeconds: z.number().nonnegative().optional(),
  elevationGainMeters: z.number().nonnegative().optional(),
  averageSpeedMps: z.number().nonnegative().optional(),
  maxSpeedMps: z.number().nonnegative().optional(),
  calories: z.number().nonnegative().optional(),
  route: rideRouteSummarySchema.optional(),
  location: rideLocationSchema.optional(),
  gear: rideGearSchema.optional(),
  source: activitySourceSchema,
  destinations: z.array(activityDestinationSchema).optional(),
  privacy: activityPrivacySchema,
  stats: z
    .record(
      z.string(),
      z.union([z.number(), z.string(), z.boolean(), z.null()])
    )
    .optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

export const activitiesFileSchema = z.object({
  version: z.literal(1),
  activities: z.array(rideActivitySchema),
})

export const summarySchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  totals: z.object({
    rides: z.number().int().nonnegative(),
    distanceMeters: z.number().nonnegative(),
    movingTimeSeconds: z.number().nonnegative(),
    elevationGainMeters: z.number().nonnegative(),
  }),
  years: z.array(
    z.object({
      year: z.number().int(),
      rides: z.number().int().nonnegative(),
      distanceMeters: z.number().nonnegative(),
      movingTimeSeconds: z.number().nonnegative(),
      elevationGainMeters: z.number().nonnegative(),
    })
  ),
  sync: z.object({
    lastImportedAt: z.string().datetime({ offset: true }).optional(),
    lastSyncedAt: z.string().datetime({ offset: true }).optional(),
    source: z.literal("keep"),
    destination: z.literal("strava"),
    routePrivacy: z.object({
      hideRoutes: z.boolean(),
      trimStartMeters: z.number().nonnegative(),
      trimEndMeters: z.number().nonnegative(),
    }),
  }),
})

export type Bounds = z.infer<typeof boundsSchema>
export type Coordinate = z.infer<typeof coordinateSchema>
export type RideActivity = z.infer<typeof rideActivitySchema>
export type RideRouteSummary = z.infer<typeof rideRouteSummarySchema>
export type RideSummary = z.infer<typeof summarySchema>
export type ActivitiesFile = z.infer<typeof activitiesFileSchema>
