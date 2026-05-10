import "maplibre-gl/dist/maplibre-gl.css"

import { useEffect, useMemo, useState } from "react"
import ReactMap, {
  type CircleLayerSpecification,
  Layer,
  type LineLayerSpecification,
  type MapRef,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre"
import type { RideActivity } from "@/lib/ridelog-schema"
import { cn } from "@/lib/utils"

const DEFAULT_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

const routeLayer: LineLayerSpecification = {
  id: "selected-route-line",
  type: "line",
  source: "selected-route",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#ef4444",
    "line-opacity": 0.96,
    "line-width": 5,
  },
}

const casingLayer: LineLayerSpecification = {
  id: "selected-route-casing",
  type: "line",
  source: "selected-route",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#050505",
    "line-opacity": 0.55,
    "line-width": 9,
  },
}

const endpointLayer: CircleLayerSpecification = {
  id: "selected-route-endpoints",
  type: "circle",
  source: "selected-route-endpoints",
  paint: {
    "circle-color": ["match", ["get", "kind"], "start", "#22c55e", "#f8fafc"],
    "circle-radius": 6,
    "circle-stroke-color": "#111827",
    "circle-stroke-width": 2,
  },
}

type RideMapProps = {
  activity: RideActivity | undefined
  className?: string
}

export function RideMap({ activity, className }: RideMapProps) {
  const [mapRef, setMapRef] = useState<MapRef | null>(null)
  const [routeFeature, setRouteFeature] =
    useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const routeHref = activity?.route?.isPrivate
    ? undefined
    : activity?.route?.href
  const styleUrl = useMemo(
    () => import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE_URL,
    []
  )
  const endpointData = useMemo(
    () =>
      routeFeature ? buildEndpointData(routeFeature) : emptyFeatureCollection(),
    [routeFeature]
  )

  useEffect(() => {
    if (!routeHref) {
      setRouteFeature(null)
      setMessage(activity ? "Route hidden" : "No ride selected")
      return
    }

    const href = new URL(
      routeHref,
      window.location.origin + import.meta.env.BASE_URL
    ).href
    let cancelled = false

    async function loadRoute() {
      setMessage(null)
      const response = await fetch(href)
      if (!response.ok) {
        throw new Error(`Route fetch failed with HTTP ${response.status}`)
      }
      const geojson = normalizeRouteGeoJson(await response.json())
      if (!cancelled) {
        setRouteFeature(geojson)
      }
    }

    loadRoute().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : "Unknown error"
      console.error("RideLog route load failed", { href, detail })
      if (!cancelled) {
        setRouteFeature(null)
        setMessage(`Route unavailable: ${detail}`)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activity, routeHref])

  useEffect(() => {
    if (!mapRef || !routeFeature) {
      return
    }

    mapRef.resize()
    const bounds = boundsFromFeature(routeFeature)
    mapRef.fitBounds(bounds, {
      padding: 48,
      duration: 650,
      maxZoom: 15,
    })
  }, [mapRef, routeFeature])

  return (
    <div
      className={cn(
        "relative min-h-[420px] overflow-hidden rounded-md border bg-[#111]",
        className
      )}
    >
      <ReactMap
        ref={setMapRef}
        initialViewState={{ longitude: 116.397, latitude: 39.908, zoom: 9 }}
        mapStyle={styleUrl}
        attributionControl={false}
        reuseMaps
        style={{ position: "absolute", inset: 0 }}
        validateStyle={false}
        onError={(event) => console.warn("RideLog map warning", event.error)}
        onLoad={(event) => event.target.resize()}
      >
        <NavigationControl position="top-right" visualizePitch />
        {routeFeature ? (
          <>
            <Source id="selected-route" type="geojson" data={routeFeature}>
              <Layer {...casingLayer} />
              <Layer {...routeLayer} />
            </Source>
            <Source
              id="selected-route-endpoints"
              type="geojson"
              data={endpointData}
            >
              <Layer {...endpointLayer} />
            </Source>
          </>
        ) : null}
      </ReactMap>
      {message ? (
        <div className="absolute inset-x-4 bottom-4 rounded-md border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
          {message}
        </div>
      ) : null}
    </div>
  )
}

function normalizeRouteGeoJson(
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

function boundsFromFeature(
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

function buildEndpointData(
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

function emptyFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: [] }
}
