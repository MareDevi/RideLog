# Deployment

RideLog should deploy as a static Vite app. The sync pipeline can run in GitHub Actions and commit or publish generated data before the hosting platform builds the frontend.

## Build Contract

The production build command is:

```bash
bun run build
```

The preview command is:

```bash
bun run preview
```

Vite loads production environment variables from `.env.production` during build. Only variables prefixed with `VITE_` are exposed to frontend code, so secrets must stay in GitHub Actions or server-side sync scripts.

The frontend fetches generated data from:

- `public/data/activities.json`
- `public/data/summary.json`
- `public/data/routes/*.geojson`

The optional `VITE_MAP_STYLE_URL` overrides the MapLibre style URL. When unset, the app uses the OpenFreeMap bright style.

## Vercel

Recommended settings:

- Framework preset: Vite.
- Install command: `bun install --frozen-lockfile`.
- Build command: `bun run build`.
- Output directory: `dist`.

Vercel should not run provider sync directly unless the job is moved to a secure serverless flow. Prefer GitHub Actions for scheduled sync because it has explicit secret access and commit history.

## Cloudflare Pages

Recommended settings:

- Build command: `bun run build`.
- Build output directory: `dist`.
- Root directory: repository root.
- Node compatibility only if later dependencies require it.

If using Cloudflare Pages with GitHub Actions generated data, trigger deployment after the data commit lands on the deployment branch.

## GitHub Actions

Use separate workflows where possible:

- `ci.yml`: install, lint, typecheck, test, build.
- `sync.yml`: scheduled/manual data sync, validation, build.
- `deploy.yml`: optional deployment trigger if not handled by Vercel or Cloudflare Git integration.

Keep sync logs terse. Mask provider tokens and avoid printing full request or response bodies.

Real sync requires these GitHub secrets:

- `KEEP_MOBILE`
- `KEEP_PASSWORD`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

## Static Assets

- Put app-owned static assets in `public` only when they need stable public URLs.
- Prefer imported assets through Vite for UI images and icons.
- Keep generated route files under a documented data folder and reference them by relative URL.
- Avoid shipping raw private exports.

## Deployment Checklist

- `bun run typecheck` passes.
- `bun run build` passes.
- Generated JSON validates against the data contract.
- Route privacy settings are applied.
- No secrets are present in `dist`, generated JSON, or logs.
- The deployed site can load with JavaScript cache cleared.
