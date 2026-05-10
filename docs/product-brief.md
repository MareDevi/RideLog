# Product Brief

## Vision

RideLog is a personal cycling record system that makes exported ride data useful again. It imports activities from Keep, syncs them to Strava, and publishes a fast, elegant web experience for reviewing rides, routes, maps, and long-term progress.

The product should feel more like a crafted cycling journal and analysis console than a generic workout clone.

## Primary Users

- A cyclist who records rides in Keep and wants reliable backup and Strava synchronization.
- A cyclist who wants a public or private web page showing ride history and routes.
- A technical user who wants scheduled GitHub Actions sync without maintaining a server.

## Initial Scope

- Import cycling activities from Keep.
- Normalize activities into a canonical RideLog schema.
- Export route artifacts when available, with privacy controls.
- Upload or reconcile activities with Strava.
- Generate frontend-readable static JSON.
- Render a polished ride list, ride detail view, route map, and aggregate statistics.
- Deploy as a static Vite build to Vercel or Cloudflare Pages.

## Future Scope

- Additional source providers such as Garmin, Coros, GPX, TCX, FIT, Apple Health export, or manual import.
- Additional destinations beyond Strava.
- Multi-sport support if it does not compromise the cycling-first UX.
- Private mode, authenticated views, or encrypted data artifacts.
- Share images and yearly posters inspired by `workouts_page`, implemented as separate generation modules.

## Non-Goals

- Do not build a full social fitness network.
- Do not require a long-running backend for the first version.
- Do not copy the full provider matrix from `workouts_page` before the core Keep-to-Strava path is reliable.
- Do not expose raw credentials, cookies, or private route files in the frontend.

## Product Decisions

- Cycling is the first-class domain. Other activities may exist later, but should not dilute the ride-focused information architecture.
- Strava is a destination and optional source of enriched metadata, not the only source of truth.
- Generated files are acceptable because they make static hosting, reviewable diffs, and GitHub Actions sync straightforward.
- Privacy controls are part of the core product, not a later polish item.
