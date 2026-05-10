# Sync Pipeline

## Goal

The first production pipeline should reliably sync Keep cycling activities to Strava and generate frontend data:

```text
Keep -> RideLog canonical data -> Strava -> static frontend JSON
```

This should work locally and in GitHub Actions.

## Local Flow

Recommended commands once sync tooling exists:

```bash
bun run sync:keep -- --dry-run
bun run sync:keep
bun run sync:strava -- --dry-run
bun run sync:strava
bun run data:generate
bun run build
```

The exact script names may change during implementation, but keep the split between import, upload, generation, and build.

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
8. Commit changed generated data, or upload it as an artifact depending on the deployment model.

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
- `RIDELOG_STRAVA_DRY_RUN`: default dry-run toggle for CI testing.

Frontend-exposed variables must use Vite's `VITE_` prefix and must not contain secrets.

## Keep Adapter

The Keep adapter should:

- Authenticate without printing credentials.
- Fetch only cycling activities for the first release.
- Download route data when available.
- Preserve provider IDs and timestamps.
- Convert provider units into canonical units.
- Tolerate missing optional fields.

If Keep access is unstable, support manual export ingestion before adding brittle browser automation.

## Strava Adapter

The Strava adapter should:

- Refresh access tokens from the refresh token.
- Search for existing activities by source ID, timestamp, distance, or previously stored Strava ID.
- Upload route files only after privacy transforms.
- Record Strava activity IDs in sync state.
- Avoid duplicate uploads on repeated runs.

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
