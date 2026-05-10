import "maplibre-gl/dist/maplibre-gl.css"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMap, {
  type CircleLayerSpecification,
  Layer,
  type LineLayerSpecification,
  type MapRef,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre"
import { ReplayControls } from "@/features/rides/replay-controls"
import {
  boundsFromFeature,
  buildEndpointData,
  emptyFeatureCollection,
  interpolateProgress,
  normalizeRouteGeoJson,
  sliceLineString,
} from "@/lib/map-geo"
import type { RideActivity } from "@/lib/ridelog-schema"
import { cn } from "@/lib/utils"

const DEFAULT_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

const BASE_REPLAY_DURATION_MS = 15000

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

const progressLineLayer: LineLayerSpecification = {
  id: "replay-progress-line",
  type: "line",
  source: "replay-progress",
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

const remainingLineLayer: LineLayerSpecification = {
  id: "replay-remaining-line",
  type: "line",
  source: "replay-remaining",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#374151",
    "line-opacity": 0.35,
    "line-width": 3,
  },
}

const markerHaloLayer: CircleLayerSpecification = {
  id: "replay-marker-halo",
  type: "circle",
  source: "replay-marker",
  paint: {
    "circle-color": "#ffffff",
    "circle-opacity": 0.25,
    "circle-radius": 12,
  },
}

const markerCoreLayer: CircleLayerSpecification = {
  id: "replay-marker-core",
  type: "circle",
  source: "replay-marker",
  paint: {
    "circle-color": "#ffffff",
    "circle-radius": 5,
    "circle-stroke-color": "#111827",
    "circle-stroke-width": 2,
  },
}

type RideMapProps = {
  activity: RideActivity | undefined
  className?: string
}

export function RideMap({ activity, className }: RideMapProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [routeFeature, setRouteFeature] =
    useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(0)

  const rAFRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  const speed = [1, 2, 4][speedIndex] ?? 1
  const showReplay = progress > 0 || isPlaying

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
    const map = mapRef.current
    if (!map || !routeFeature) {
      return
    }

    map.resize()
    const bounds = boundsFromFeature(routeFeature)
    map.fitBounds(bounds, {
      padding: 48,
      duration: 650,
      maxZoom: 15,
    })
  }, [routeFeature])

  // biome-ignore lint/correctness/useExhaustiveDependencies: activity id change triggers replay reset
  useEffect(() => {
    setIsPlaying(false)
    setProgress(0)
    setSpeedIndex(0)
    lastTimeRef.current = null
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current)
      rAFRef.current = null
    }
  }, [activity?.id])

  useEffect(() => {
    if (!isPlaying) {
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current)
        rAFRef.current = null
      }
      lastTimeRef.current = null
      return
    }

    const totalMs = BASE_REPLAY_DURATION_MS / speed

    function tick(timestamp: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
      }
      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      setProgress((prev) => {
        const next = prev + delta / totalMs
        if (next >= 1) {
          setIsPlaying(false)
          return 1
        }
        return next
      })

      rAFRef.current = requestAnimationFrame(tick)
    }

    rAFRef.current = requestAnimationFrame(tick)

    return () => {
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current)
        rAFRef.current = null
      }
    }
  }, [isPlaying, speed])

  const replayGeoJSON = useMemo(() => {
    if (!routeFeature || !showReplay) return null

    const currentCoord = interpolateProgress(routeFeature, progress)
    const progressLine = sliceLineString(routeFeature, 0, progress)
    const remainingLine = sliceLineString(routeFeature, progress, 1)
    const markerPoint: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: currentCoord },
    }

    return { progressLine, remainingLine, markerPoint }
  }, [routeFeature, progress, showReplay])

  const hasRoute = !!routeFeature && !activity?.route?.isPrivate

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  const handleSetProgress = useCallback((value: number) => {
    setIsPlaying(false)
    setProgress(value)
  }, [])

  const handleSetSpeedIndex = useCallback((index: number) => {
    setSpeedIndex(index)
  }, [])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setProgress(0)
  }, [])

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
        {routeFeature ? (
          <>
            <Source id="selected-route" type="geojson" data={routeFeature}>
              <Layer {...casingLayer} />
              {!showReplay && <Layer {...routeLayer} />}
            </Source>
            <Source
              id="selected-route-endpoints"
              type="geojson"
              data={endpointData}
            >
              <Layer {...endpointLayer} />
            </Source>
            {replayGeoJSON && (
              <>
                <Source
                  id="replay-progress"
                  type="geojson"
                  data={replayGeoJSON.progressLine}
                >
                  <Layer {...progressLineLayer} />
                </Source>
                <Source
                  id="replay-remaining"
                  type="geojson"
                  data={replayGeoJSON.remainingLine}
                >
                  <Layer {...remainingLineLayer} />
                </Source>
                <Source
                  id="replay-marker"
                  type="geojson"
                  data={replayGeoJSON.markerPoint}
                >
                  <Layer {...markerHaloLayer} />
                  <Layer {...markerCoreLayer} />
                </Source>
              </>
            )}
          </>
        ) : null}
      </ReactMap>
      {message ? (
        <div className="absolute inset-x-4 bottom-4 rounded-md border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
          {message}
        </div>
      ) : null}
      {hasRoute && !message && (
        <ReplayControls
          isPlaying={isPlaying}
          progress={progress}
          speedIndex={speedIndex}
          onTogglePlay={handleTogglePlay}
          onSetProgress={handleSetProgress}
          onSetSpeedIndex={handleSetSpeedIndex}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
