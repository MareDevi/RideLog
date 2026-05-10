# UI Guidelines

## Direction

RideLog should feel like a precise cycling dashboard and visual journal. The interface should be calm, map-forward, and highly readable. Avoid generic landing-page composition; the first screen should show the actual riding experience: latest rides, route/map context, and meaningful stats.

## Design System

- Use shadcn/ui as the base component system.
- Components generated into `src/components/ui` are owned by this project but should stay generic.
- Compose product-specific components in `src/components/rides`, `src/components/maps`, `src/components/stats`, or feature folders.
- Use Tailwind CSS variables from `src/index.css` for theme tokens.
- Keep both light and dark modes polished.
- Prefer restrained radius and crisp spacing for data surfaces.

Current `components.json` uses:

- `style`: `base-luma`.
- `baseColor`: `neutral`.
- `iconLibrary`: `hugeicons`.
- Animate UI registry: `@animate-ui`.

## Animate UI

Animate UI should support comprehension:

- Sliding numbers for changing totals.
- Subtle list transitions when filters change.
- Route reveal or scrub animation for ride details.
- Sync status feedback.
- Dialog, tooltip, and segmented-control motion when useful.

Avoid heavy page-wide motion. Ride data should remain scannable.

## Core Screens

The current v1 app implements one static dashboard surface in `src/App.tsx` with a MapLibre map module in `src/components/ride-map.tsx`. It fetches generated JSON from `public/data` at runtime and validates it with the shared Zod schemas before rendering.

### Dashboard

The dashboard should include:

- latest ride summary.
- total distance, riding time, elevation gain, and ride count.
- compact calendar or contribution-style activity density.
- map preview of recent or selected routes.
- quick filters for year, month, distance, and route visibility.

### Ride List

Each ride row or card should show:

- ride title.
- date and local time.
- distance.
- moving time.
- elevation gain.
- average speed.
- source and Strava sync state.
- route thumbnail or map hint when available.

### Ride Detail

Ride detail should show:

- full route map.
- key stats.
- splits or derived stats if available.
- source metadata.
- Strava link when synced.
- privacy indicators when route data is trimmed or hidden.

### Map View

Map view should support:

- all visible rides.
- selected year or date range.
- route hover and selection.
- empty state when route data is hidden.
- mobile-friendly controls.

Current map strategy:

- MapLibre GL JS renders the selected ride route.
- OpenFreeMap bright style is the default base map.
- `VITE_MAP_STYLE_URL` can replace the style without code changes.
- Hidden or missing routes show a non-coordinate empty state while list and stats remain usable.

## Interaction Rules

- Use icon buttons for compact map and toolbar actions.
- Use segmented controls for major view modes.
- Use toggles for privacy and binary filters.
- Use sliders or numeric inputs for distance and date thresholds when needed.
- Use tooltips for icon-only actions.
- Ensure text never overflows buttons, cards, or compact stat blocks.

## Visual Rules

- Do not rely on a one-note neutral palette. Add measured cycling-oriented accents for route, elevation, and sync state.
- Avoid decorative gradient blobs and stock-like imagery.
- Make maps and route geometry primary visual assets.
- Use charts sparingly and only when they answer a clear question.
- Keep page sections unframed; use cards for repeated activities, stat modules, dialogs, and tool surfaces.

## Accessibility

- Preserve keyboard navigation for filters, dialogs, maps controls, and lists.
- Use semantic buttons, links, headings, and landmarks.
- Keep contrast sufficient in both themes.
- Provide non-map summaries for users who cannot inspect map geometry.
- Respect reduced motion preferences.
