# Sync Pipeline

## Goal

The first production pipeline should reliably sync Keep cycling activities to Strava and generate frontend data:

```text
Keep -> RideLog canonical data -> Strava -> static frontend JSON
```

This should work locally and in GitHub Actions.

## Local Flow

Implemented commands:

```bash
bun run sync:keep -- --dry-run
bun run sync:keep
bun run sync:strava -- --dry-run
bun run sync:strava
bun run data:generate
bun run build
```

`bun run sync -- --dry-run` runs Keep import, Strava reconciliation, and data generation in order without writing Keep staging files or mutating Strava. `bun run sync` performs the same sequence with real provider writes where credentials are present.

## GitHub Actions Flow

Use a scheduled workflow plus manual dispatch:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "15 20 * * *"
```

The job should:

1. Check out the repository.
2. Install Bun.
3. Install dependencies with `bun install --frozen-lockfile`.
4. Run Keep import.
5. Run Strava reconciliation/upload.
6. Generate public data.
7. Run typecheck/build.
8. Build the static frontend.

The current `sync.yml` supports scheduled and manual runs. Scheduled runs and manual runs with `dry_run: true` use `bun run sync -- --dry-run`; manual runs with `dry_run: false` use real provider sync. Generated data committing is intentionally left out until a persistence choice is made for private state.

## Secrets

Expected GitHub Actions secrets:

- `KEEP_MOBILE` or provider account identifier.
- `KEEP_PASSWORD` or refresh token if Keep auth supports it.
- `STRAVA_CLIENT_ID`.
- `STRAVA_CLIENT_SECRET`.
- `STRAVA_REFRESH_TOKEN`.

Never write these into generated files, logs, screenshots, or frontend environment variables.

## Environment Variables

Recommended non-secret variables:

- `RIDELOG_SYNC_SINCE`: optional ISO date to limit first import.
- `RIDELOG_PUBLIC_BASE_URL`: deployed site URL.
- `RIDELOG_PRIVACY_TRIM_START_METERS`: default route start trim.
- `RIDELOG_PRIVACY_TRIM_END_METERS`: default route end trim.
- `RIDELOG_HIDE_ROUTES`: hide all public route geometry and Strava GPX upload geometry.
- `VITE_MAP_STYLE_URL`: optional frontend map style URL. Defaults to OpenFreeMap bright style.

Frontend-exposed variables must use Vite's `VITE_` prefix and must not contain secrets.

## Keep Adapter

The Keep adapter:

- Authenticate without printing credentials.
- Fetches only `outdoorCycling` activities for the first release.
- Downloads route data when available.
- Preserve provider IDs and timestamps.
- Converts Keep route coordinates from GCJ-02 to WGS84.
- Tolerates missing optional fields.

If Keep access is unstable, support manual export ingestion before adding brittle browser automation.

## Strava Adapter

The Strava adapter:

- Refreshes access tokens from the refresh token.
- Uses sync state checksums and Strava activity IDs to avoid duplicate uploads.
- Uploads GPX files only after privacy transforms.
- Records Strava upload and activity IDs in `data/private/sync-state.json`.

## Sync State

Recommended private state file:

```json
{
  "version": 1,
  "activities": {
    "keep:123456": {
      "canonicalId": "keep_123456",
      "sourceChecksum": "sha256:...",
      "routeChecksum": "sha256:...",
      "stravaActivityId": "987654321",
      "lastImportedAt": "2026-05-10T12:00:00+08:00",
      "lastSyncedAt": "2026-05-10T12:01:00+08:00"
    }
  }
}
```

Keep private state separate from public frontend data when it contains provider IDs the user does not want to expose.

Private files are ignored by git:

```text
data/private/sync-state.json
data/private/staging/*.json
data/private/staging/*.raw.json
```

## Privacy

Before any public write or Strava upload:

- Trim start and end points when configured.
- Optionally remove the full route and keep only city-level metadata.
- Ensure generated bounds do not reveal hidden start or end locations.
- Keep raw original route files out of public deployment outputs.

## Failure Modes

- Auth failure: fail fast and ask for refreshed secrets.
- Keep import partial failure: keep prior public data unchanged.
- Strava upload failure: record failed activity IDs and continue only if no mutation consistency risk exists.
- Data validation failure: do not replace generated frontend JSON.
