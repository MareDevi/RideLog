export function normalizeRouteGeoJson(
  value: unknown
): GeoJSON.Feature<GeoJSON.LineString> {
  const feature = isFeatureCollection(value) ? value.features.at(0) : value

  if (
    !feature ||
    typeof feature !== "object" ||
    (feature as GeoJSON.Feature).type !== "Feature" ||
    (feature as GeoJSON.Feature).geometry?.type !== "LineString"
  ) {
    throw new Error("invalid GeoJSON route")
  }

  const lineFeature = feature as GeoJSON.Feature<GeoJSON.LineString>
  if (lineFeature.geometry.coordinates.length < 2) {
    throw new Error("route has fewer than two points")
  }

  return lineFeature
}

function isFeatureCollection(
  value: unknown
): value is GeoJSON.FeatureCollection {
  return (
    !!value &&
    typeof value === "object" &&
    (value as GeoJSON.FeatureCollection).type === "FeatureCollection" &&
    Array.isArray((value as GeoJSON.FeatureCollection).features)
  )
}

export function boundsFromFeature(
  feature: GeoJSON.Feature<GeoJSON.LineString>
): [[number, number], [number, number]] {
  const coordinates = feature.geometry.coordinates
  const longitudes = coordinates.map((coordinate) => coordinate[0])
  const latitudes = coordinates.map((coordinate) => coordinate[1])
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ]
}

export function boundsFromFeatureCollection(
  collection: GeoJSON.FeatureCollection<GeoJSON.LineString>
): [[number, number], [number, number]] | null {
  const points: [number, number][] = []

  for (const feature of collection.features) {
    if (feature.geometry.type !== "LineString") continue
    for (const [lng, lat] of feature.geometry.coordinates) {
      points.push([lng, lat])
    }
  }

  if (points.length === 0) return null

  // Density-aware bounds: focus on the area where most points cluster.
  // This prevents a few outlier routes (e.g. one ride in a distant city)
  // from pulling the viewport to the geometric center of everything.
  const sortedLng = points.map((p) => p[0]).sort((a, b) => a - b)
  const sortedLat = points.map((p) => p[1]).sort((a, b) => a - b)
  const medianLng = sortedLng[Math.floor(sortedLng.length / 2)]
  const medianLat = sortedLat[Math.floor(sortedLat.length / 2)]

  const distances = points
    .map(([lng, lat]) =>
      Math.sqrt((lng - medianLng) ** 2 + (lat - medianLat) ** 2)
    )
    .sort((a, b) => a - b)

  // Use the 90th percentile distance as a cutoff, with a 1.5x margin
  // to avoid over-cropping when all routes are in the same region.
  const cutoffIndex = Math.min(
    Math.floor(distances.length * 0.9),
    distances.length - 1
  )
  const cutoff = distances[cutoffIndex] ?? distances.at(-1) ?? 0
  const threshold = Math.max(cutoff * 1.5, 0.001)

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let kept = 0

  for (const [lng, lat] of points) {
    const d = Math.sqrt((lng - medianLng) ** 2 + (lat - medianLat) ** 2)
    if (d <= threshold) {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
      kept++
    }
  }

  // Fallback to all points if the filter was too aggressive.
  if (kept === 0) {
    return [
      [sortedLng[0], sortedLat[0]],
      [sortedLng.at(-1) ?? sortedLng[0], sortedLat.at(-1) ?? sortedLat[0]],
    ]
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

export function buildEndpointData(
  feature: GeoJSON.Feature<GeoJSON.LineString>
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const coordinates = feature.geometry.coordinates
  const start = coordinates[0]
  const end = coordinates.at(-1) ?? start
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "start" },
        geometry: { type: "Point", coordinates: start },
      },
      {
        type: "Feature",
        properties: { kind: "end" },
        geometry: { type: "Point", coordinates: end },
      },
    ],
  }
}

export function emptyFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: [] }
}

export function interpolateProgress(
  feature: GeoJSON.Feature<GeoJSON.LineString>,
  progress: number
): [number, number] {
  const coordinates = feature.geometry.coordinates
  const total = coordinates.length - 1
  if (total <= 0) return [...coordinates[0]] as [number, number]
  if (progress <= 0) return [...coordinates[0]] as [number, number]
  if (progress >= 1) return [...coordinates[total]] as [number, number]

  const rawIdx = progress * total
  const idx = Math.floor(rawIdx)
  const frac = rawIdx - idx
  const p0 = coordinates[idx]
  const p1 = coordinates[idx + 1]

  return [p0[0] + frac * (p1[0] - p0[0]), p0[1] + frac * (p1[1] - p0[1])]
}

export function sliceLineString(
  feature: GeoJSON.Feature<GeoJSON.LineString>,
  startProgress: number,
  endProgress: number
): GeoJSON.Feature<GeoJSON.LineString> {
  const coordinates = feature.geometry.coordinates
  const total = coordinates.length - 1
  if (total <= 0) {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [...coordinates] },
    }
  }

  const clampedStart = Math.max(0, Math.min(1, startProgress))
  const clampedEnd = Math.max(0, Math.min(1, endProgress))

  if (clampedStart >= clampedEnd) {
    const pt = interpolateProgress(feature, clampedStart)
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [pt, pt] },
    }
  }

  const startRaw = clampedStart * total
  const endRaw = clampedEnd * total
  const startIdx = Math.floor(startRaw)
  const endIdx = Math.ceil(endRaw)

  const result: [number, number][] = []

  result.push(interpolateProgress(feature, clampedStart))

  for (let i = startIdx + 1; i < endIdx && i <= total; i++) {
    if (i >= 0) {
      result.push([...coordinates[i]] as [number, number])
    }
  }

  const endPt = interpolateProgress(feature, clampedEnd)
  const lastPt = result[result.length - 1]
  if (lastPt[0] !== endPt[0] || lastPt[1] !== endPt[1]) {
    result.push(endPt)
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: result },
  }
}
