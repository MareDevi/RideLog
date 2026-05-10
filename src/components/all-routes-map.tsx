import "maplibre-gl/dist/maplibre-gl.css"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMap, {
  Layer,
  type LineLayerSpecification,
  type MapRef,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre"
import { boundsFromFeatureCollection } from "@/lib/map-geo"
import { cn } from "@/lib/utils"

const DEFAULT_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

const allRoutesLayer: LineLayerSpecification = {
  id: "all-routes-line",
  type: "line",
  source: "all-routes",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": ["get", "color"],
    "line-width": 2,
    "line-opacity": 0.55,
    "line-blur": 1,
  },
}

type AllRoutesMapProps = {
  className?: string
}

export function AllRoutesMap({ className }: AllRoutesMapProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [geoData, setGeoData] =
    useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null)
  const [message, setMessage] = useState<string | null>("Loading routes…")

  const styleUrl = useMemo(
    () => import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE_URL,
    []
  )

  useEffect(() => {
    let cancelled = false

    async function loadRoutes() {
      const href = new URL(
        "/data/all-routes.geojson",
        window.location.origin + import.meta.env.BASE_URL
      ).href

      try {
        const response = await fetch(href)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data =
          (await response.json()) as GeoJSON.FeatureCollection<GeoJSON.LineString>
        if (!cancelled) {
          setGeoData(data)
          setMessage(null)
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error"
        console.error("RideLog all-routes load failed", { href, detail })
        if (!cancelled) {
          setMessage(`Routes unavailable: ${detail}`)
        }
      }
    }

    loadRoutes()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !geoData) return

    const bounds = boundsFromFeatureCollection(geoData)
    if (!bounds) return

    map.resize()
    map.fitBounds(bounds, {
      padding: 48,
      duration: 750,
      maxZoom: 15,
    })
  }, [geoData])

  return (
    <div
      className={cn(
        "relative min-h-[420px] overflow-hidden rounded-md border bg-[#111]",
        className
      )}
    >
      <ReactMap
        ref={mapRef}
        initialViewState={{
          longitude: 116.397,
          latitude: 39.908,
          zoom: 9,
        }}
        mapStyle={styleUrl}
        attributionControl={false}
        reuseMaps
        style={{ position: "absolute", inset: 0 }}
        validateStyle={false}
        onError={(event) => console.warn("RideLog map warning", event.error)}
        onLoad={(event) => event.target.resize()}
      >
        <NavigationControl position="top-right" visualizePitch />
        {geoData ? (
          <Source id="all-routes" type="geojson" data={geoData}>
            <Layer {...allRoutesLayer} />
          </Source>
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
