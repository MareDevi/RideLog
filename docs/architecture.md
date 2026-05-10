# Architecture

## System Shape

RideLog should be split into three clear layers:

1. Sync layer: imports provider data, writes route artifacts, uploads to destinations, and records sync state.
2. Data layer: normalizes provider payloads into deterministic static JSON consumed by the app.
3. Frontend layer: renders rides, maps, filters, statistics, and settings from the canonical data contract.

The app should remain static-first. GitHub Actions can perform scheduled sync and commit generated public artifacts. Vercel or Cloudflare Pages can then build the frontend from the repository.

```text
Keep export/API
  -> source adapter
  -> normalizer
  -> canonical activities + route artifacts + sync state
  -> Strava destination adapter
  -> generated public JSON
  -> Vite React app
```

## Recommended Repository Shape

```text
src/
  components/
    ui/
    app/
    rides/
    maps/
    stats/
  data/
  features/
    rides/
    sync-status/
  hooks/
  lib/
  routes/
sync/
  adapters/
    keep/
    strava/
  normalizers/
  state/
  privacy/
  cli/
data/
  activities.json
  routes/
  sync-state.json
docs/
  reference/
```

This structure is a target, not a requirement for every early commit. Add folders when a real feature needs them.

## Frontend Boundaries

- `src/components/ui` contains shadcn/ui and Animate UI generated primitives.
- Product components compose primitives outside `ui`.
- Feature modules own data loading, filtering, and view composition for one product area.
- Map rendering should be isolated behind a `maps` module so the provider can change later.
- Generated data imports should be typed at the boundary and validated before rendering.

## Sync Boundaries

Adapters should not write frontend-specific JSON directly. They should return provider data and artifacts to the normalizer.

Recommended interfaces:

```ts
type SourceAdapter = {
  provider: string
  listActivities(options: SyncOptions): Promise<SourceActivity[]>
  downloadRoute(activity: SourceActivity): Promise<RouteArtifact | null>
}

type DestinationAdapter = {
  provider: string
  findExisting(activity: RideActivity): Promise<DestinationMatch | null>
  upload(activity: RideActivity, route: RouteArtifact | null): Promise<DestinationUpload>
}
```

The implementation language for sync can be TypeScript or Python, but avoid mixing languages in one pipeline unless there is a strong library reason. For this repository, TypeScript is the better default because the app already uses it and shared schemas can be reused.

## State and Idempotency

Sync state should record:

- source provider and source activity ID.
- canonical activity ID.
- route checksum.
- Strava activity ID after upload.
- last successful sync timestamp.
- privacy decisions applied before export.

The state file must make repeated runs safe. If an activity has already been uploaded and the normalized checksum is unchanged, the sync should skip mutation.

## Error Handling

- Provider auth failures should fail the sync early with a clear message.
- Partial sync failures should preserve already downloaded artifacts and record what was skipped.
- Generated data should only be replaced after a successful normalization pass.
- Strava mutation steps should support dry-run mode.

## Testing Strategy

- Unit test normalizers with fixture payloads.
- Unit test privacy trimming and route simplification.
- Integration test adapter parsing with recorded sanitized fixtures.
- Frontend test the ride list, filters, empty states, and map fallback rendering.
- Build test in CI with `bun run build`.
