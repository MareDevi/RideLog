# RideLog Documentation

RideLog is a cycling-first activity log and sync project. It starts with Keep cycling export and Strava sync, then presents the result as a modern static web app with ride history, routes, maps, and progress summaries.

## Documents

- [Product Brief](./product-brief.md): product goals, users, scope, and non-goals.
- [Architecture](./architecture.md): system boundaries and recommended repository shape.
- [Data Contract](./data-contract.md): canonical activity schema and generated data rules.
- [Sync Pipeline](./sync-pipeline.md): Keep import, Strava upload, state, secrets, and GitHub Actions flow.
- [Deployment](./deployment.md): Vercel, Cloudflare Pages, static build, and workflow expectations.
- [UI Guidelines](./ui-guidelines.md): shadcn/ui, Animate UI, layout, maps, and visual direction.

## Reference

`docs/reference/workouts_page` is kept as a reference project. It demonstrates scheduled activity sync, provider-specific scripts, generated public activity data, and map-centered pages. RideLog should keep those useful concepts but use a clearer modern architecture with narrower provider adapters, an explicit data contract, and a composed shadcn/ui frontend.
