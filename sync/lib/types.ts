import { z } from "zod"
import {
  coordinateSchema,
  rideActivitySchema,
} from "../../src/lib/ridelog-schema"

export const routePointSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  altitude: z.number().optional(),
  timestamp: z.number().optional(),
  time: z.string().datetime({ offset: true }).optional(),
  heartRate: z.number().int().positive().optional(),
})

export const stagedActivitySchema = rideActivitySchema.extend({
  privateRoute: z
    .object({
      points: z.array(routePointSchema),
      coordinates: z.array(coordinateSchema),
      sourceChecksum: z.string(),
      routeChecksum: z.string().optional(),
    })
    .optional(),
})

export const syncStateSchema = z.object({
  version: z.literal(1),
  activities: z.record(
    z.string(),
    z.object({
      canonicalId: z.string(),
      sourceChecksum: z.string().optional(),
      routeChecksum: z.string().optional(),
      stravaActivityId: z.string().optional(),
      stravaUploadId: z.string().optional(),
      stravaUrl: z.string().url().optional(),
      lastImportedAt: z.string().datetime({ offset: true }).optional(),
      lastSyncedAt: z.string().datetime({ offset: true }).optional(),
      lastError: z.string().optional(),
    })
  ),
})

export type RoutePoint = z.infer<typeof routePointSchema>
export type StagedActivity = z.infer<typeof stagedActivitySchema>
export type SyncState = z.infer<typeof syncStateSchema>
