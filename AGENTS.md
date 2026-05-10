# RideLog Agent Instructions

RideLog is a modern cycling log application. The product goal is to import cycling data exported from Keep, sync it to Strava, and present rides, routes, maps, and yearly progress in a polished web UI. The first reliable path is `Keep -> normalized activity files -> Strava sync -> static frontend data`. Future integrations should fit the same pipeline instead of adding one-off page logic.

## Project Principles

- Prefer a small, explicit domain model over provider-shaped data leaking into the UI.
- Treat `docs/reference/workouts_page` as inspiration, not source to copy. Keep its useful ideas: scheduled sync, platform adapters, generated static data, and map-focused presentation. Do not inherit its broad script surface or mixed concerns unless a feature genuinely needs it.
- Keep the app deployable as a static Vite site on Vercel or Cloudflare Pages.
- Keep data sync runnable locally and in GitHub Actions.
- Never commit user secrets, raw credentials, session cookies, or private full-resolution route files unless the user explicitly asks for public route data.
- Preserve user changes. If the worktree is dirty, read before editing and avoid reverting unrelated files.

## Current Stack

- Runtime: React 19 with TypeScript.
- Build tool: Vite.
- Styling: Tailwind CSS 4 with CSS variables in `src/index.css`.
- UI system: shadcn/ui components owned in `src/components/ui`.
- Animated UI: Animate UI registry via `components.json`, backed by Motion.
- Package manager: Bun is preferred because `bun.lock` is present.
- Quality tools: TypeScript, Biome, and the existing `package.json` scripts.

Use Context7 MCP whenever working from current library, framework, SDK, API, CLI, or cloud-service documentation. For shadcn/ui components, prefer the local shadcn MCP tools when selecting or installing components.

## Commands

- Install dependencies: `bun install`
- Start dev server: `bun run dev`
- Build: `bun run build`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Format/check with writes: `bun run check`
- Preview production build: `bun run preview`

Run `bun run build` before finalizing changes that affect app code, routing, generated data consumption, or deployment configuration. Run narrower checks when editing only documentation.

## Repository Layout

- `src/components/ui`: generated or vendored shadcn/ui and Animate UI primitives. Keep these generic.
- `src/components`: product components composed from UI primitives.
- `src/lib`: shared framework-agnostic helpers.
- `src/hooks`: reusable React hooks.
- `src/features`: feature modules when the app grows beyond the starter shape.
- `src/data` or `src/static`: checked-in generated public activity data consumed by the frontend.
- `scripts` or `sync`: provider adapters, normalization, export, and upload code.
- `.github/workflows`: scheduled sync and deployment workflows.
- `docs`: project documentation. Keep reference material under `docs/reference` separate from authored RideLog docs.

## UI Rules

- Use shadcn/ui for accessible primitives and ownership of component code.
- Use Animate UI only for meaningful motion: route reveal, stat transitions, filtering transitions, upload/sync state, and compact feedback. Avoid ornamental animation that slows scanning.
- Keep `src/components/ui` close to upstream generated code. Product-specific behavior belongs in composed components outside `ui`.
- Prefer icons for compact tool actions. Use the configured icon library unless a component already requires a different icon dependency.
- Design for a data-heavy cycling dashboard: dense, calm, map-forward, keyboard-friendly, and readable in both light and dark themes.
- Cards should frame repeated activities, summaries, and dialogs. Do not nest cards inside cards.

## Data Rules

- Normalize all provider data into the project activity schema before UI consumption.
- Store provider-specific raw fields under `source.raw` or adapter-private files, not top-level UI data.
- Use stable activity IDs derived from source provider and source activity ID.
- Preserve units explicitly. Internally prefer meters, seconds, ISO 8601 timestamps, and WGS84 coordinates.
- Route privacy must be explicit. Support start/end trimming and route hiding before public export.
- Generated JSON should be deterministic so Git diffs are reviewable.

## Sync Rules

- Model integrations as adapters:
  - source adapters import activities and route files.
  - destination adapters upload or reconcile activities.
  - normalizers convert provider payloads into the canonical schema.
- Keep Keep and Strava credentials in environment variables or GitHub Actions secrets.
- Sync must be idempotent. Re-running a workflow should not duplicate Strava activities or rewrite unchanged generated files.
- Maintain a sync state file that records provider IDs, upload IDs, checksums, and timestamps.
- Add dry-run support before adding mutating provider operations.

## Documentation Rules

- Update `docs/architecture.md` when changing system boundaries.
- Update `docs/data-contract.md` when changing generated JSON or activity fields.
- Update `docs/sync-pipeline.md` when changing provider sync behavior, secrets, or GitHub Actions.
- Update `docs/deployment.md` when changing hosting, build, or environment assumptions.
- Update `docs/ui-guidelines.md` when changing product UI direction, component strategy, or motion rules.

## Coding Style

- Keep TypeScript strict and explicit at module boundaries.
- Prefer pure transforms for data normalization and small tested functions for provider quirks.
- Avoid global mutable state in sync logic except for explicit state stores.
- Prefer structured parsers for GPX, TCX, FIT, CSV, JSON, and polyline data.
- Keep public frontend bundles free of secrets and private raw exports.

## Reference Project Boundary

`docs/reference/workouts_page` is read-only reference material. Do not edit it unless the user explicitly asks. When borrowing an idea, re-express it in RideLog terms and document the decision.
