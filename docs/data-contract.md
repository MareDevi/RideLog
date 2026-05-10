# Data Contract

The frontend should consume canonical RideLog data, not provider-native Keep or Strava payloads. This keeps UI code stable as providers change.

## Units and Formats

- Distance: meters.
- Duration: seconds.
- Elevation: meters.
- Speed: meters per second.
- Time: ISO 8601 strings with timezone when known.
- Coordinates: WGS84 `[longitude, latitude]`.
- Encoded routes: Google encoded polyline or GeoJSON, with the format named explicitly.
- IDs: stable strings.

## Activity Schema

```ts
export type RideActivity = {
  id: string
  type: "cycling"
  title: string
  startTime: string
  endTime?: string
  timezone?: string
  distanceMeters: number
  movingTimeSeconds?: number
  elapsedTimeSeconds?: number
  elevationGainMeters?: number
  averageSpeedMps?: number
  maxSpeedMps?: number
  calories?: number
  route?: RideRouteSummary
  location?: RideLocation
  gear?: RideGear
  source: ActivitySource
  destinations?: ActivityDestination[]
  privacy: ActivityPrivacy
  stats?: Record<string, number | string | boolean | null>
  createdAt: string
  updatedAt: string
}
```

## Route Schema

```ts
export type RideRouteSummary = {
  id: string
  format: "polyline" | "geojson" | "gpx"
  href: string
  pointCount?: number
  bounds?: {
    west: number
    south: number
    east: number
    north: number
  }
  start?: [number, number]
  end?: [number, number]
  isPrivate: boolean
}
```

Route detail files should live outside the main activity index so the list view stays small.

## Source and Destination Metadata

```ts
export type ActivitySource = {
  provider: "keep" | "strava" | "gpx" | "tcx" | "fit" | string
  activityId: string
  importedAt: string
  checksum?: string
}

export type ActivityDestination = {
  provider: "strava" | string
  activityId: string
  url?: string
  syncedAt: string
}
```

## Privacy Schema

```ts
export type ActivityPrivacy = {
  visibility: "public" | "private" | "unlisted"
  hideRoute: boolean
  trimStartMeters?: number
  trimEndMeters?: number
  appliedAt?: string
}
```

Privacy transforms must run before files are written to public frontend data.

## Generated Files

Implemented public data files:

```text
public/data/
  activities.json
  summary.json
  all-routes.geojson
  routes/
    <activity-id>.geojson
```

`all-routes.geojson` is a GeoJSON `FeatureCollection<LineString>` containing every public (non-private) route in a single file. Each feature carries:

- `activityId`: canonical activity ID.
- `title`: activity title.
- `year`: the UTC year of the activity start time.
- `color`: a per-feature line color (data-driven by the map layer).

Features are sorted by `startTime` ascending (oldest first) so newer routes render on top. This file powers the "all routes overlay" map view and avoids N individual HTTP requests.

`activities.json` should be deterministic:

- Sort by `startTime` descending.
- Sort object keys if the generator supports it.
- Avoid volatile generation timestamps except in fields that explicitly represent sync time.
- Keep provider raw payloads out of public files.

## Validation

Every generated activity should pass validation before replacing public data:

- `id`, `type`, `title`, `startTime`, `distanceMeters`, `source`, and `privacy` are required.
- `distanceMeters` and duration fields cannot be negative.
- Route file references must exist unless `hideRoute` is true.
- Coordinates must be valid longitude and latitude pairs.
- Strava destination IDs must only appear after confirmed upload or match.

## Runtime Contract

The canonical schemas live in `src/lib/ridelog-schema.ts` and are validated with Zod before generated files are replaced. Script-only staged data extends `RideActivity` with a private route payload:

```ts
type StagedActivity = RideActivity & {
  privateRoute?: {
    points: RoutePoint[]
    coordinates: [number, number][]
    sourceChecksum: string
    routeChecksum?: string
  }
}
```

`privateRoute` is never written to `public/data`. Route privacy is applied before GeoJSON generation and before Strava GPX upload.

`summary.json` contains deterministic totals plus sync metadata:

```ts
type Summary = {
  version: 1
  generatedAt: string
  totals: {
    rides: number
    distanceMeters: number
    movingTimeSeconds: number
    elevationGainMeters: number
  }
  years: Array<{
    year: number
    rides: number
    distanceMeters: number
    movingTimeSeconds: number
    elevationGainMeters: number
  }>
  sync: {
    lastImportedAt?: string
    lastSyncedAt?: string
    source: "keep"
    destination: "strava"
    routePrivacy: {
      hideRoutes: boolean
      trimStartMeters: number
      trimEndMeters: number
    }
  }
}
```
