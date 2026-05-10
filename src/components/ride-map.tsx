import "maplibre-gl/dist/maplibre-gl.css"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMap, {
	type CircleLayerSpecification,
	Layer,
	type LineLayerSpecification,
	type MapRef,
	NavigationControl,
	Source,
} from "react-map-gl/maplibre"
import { PauseIcon, PlayIcon, ReplayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { RideActivity } from "@/lib/ridelog-schema"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

const DEFAULT_STYLE_URL =
	"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

const BASE_REPLAY_DURATION_MS = 15000
const SPEEDS = [1, 2, 4] as const

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
		"circle-color": [
			"match",
			["get", "kind"],
			"start",
			"#22c55e",
			"#f8fafc",
		],
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
	const [mapRef, setMapRef] = useState<MapRef | null>(null)
	const [routeFeature, setRouteFeature] =
		useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null)
	const [message, setMessage] = useState<string | null>(null)

	const [isPlaying, setIsPlaying] = useState(false)
	const [progress, setProgress] = useState(0)
	const [speedIndex, setSpeedIndex] = useState(0)

	const rAFRef = useRef<number | null>(null)
	const lastTimeRef = useRef<number | null>(null)

	const speed = SPEEDS[speedIndex]
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
			routeFeature
				? buildEndpointData(routeFeature)
				: emptyFeatureCollection(),
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
			const detail =
				error instanceof Error ? error.message : "Unknown error"
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

	const totalSeconds = Math.round(BASE_REPLAY_DURATION_MS / 1000)
	const currentSeconds = Math.round(progress * totalSeconds)

	const hasRoute = !!routeFeature && !activity?.route?.isPrivate

	return (
		<div
			className={cn(
				"relative min-h-[420px] overflow-hidden rounded-md border bg-[#111]",
				className
			)}
		>
			<ReactMap
				ref={setMapRef}
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
				onError={(event) =>
					console.warn("RideLog map warning", event.error)
				}
				onLoad={(event) => event.target.resize()}
			>
				<NavigationControl position="top-right" visualizePitch />
				{routeFeature ? (
					<>
						<Source
							id="selected-route"
							type="geojson"
							data={routeFeature}
						>
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
				<div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-lg border bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
					<Button
						size="icon-xs"
						variant="ghost"
						onClick={() => setIsPlaying((p) => !p)}
						aria-label={isPlaying ? "Pause" : "Play"}
					>
						<HugeiconsIcon
							icon={isPlaying ? PauseIcon : PlayIcon}
							size={14}
						/>
					</Button>

					<Slider
						value={[Math.round(progress * 100)]}
						min={0}
						max={100}
						step={1}
						onValueChange={(value) => {
							setIsPlaying(false)
							const v = Array.isArray(value) ? value[0] : value
							setProgress(v / 100)
						}}
						className="flex-1"
					/>

					<span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
						{formatReplayTime(currentSeconds)} /{" "}
						{formatReplayTime(totalSeconds)}
					</span>

					<Button
						size="xs"
						variant="ghost"
						className="tabular-nums"
						onClick={() =>
							setSpeedIndex((i) => (i + 1) % SPEEDS.length)
						}
					>
						{speed}x
					</Button>

					<Button
						size="icon-xs"
						variant="ghost"
						onClick={() => {
							setIsPlaying(false)
							setProgress(0)
						}}
						aria-label="Reset"
					>
						<HugeiconsIcon icon={ReplayIcon} size={14} />
					</Button>
				</div>
			)}
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

function interpolateProgress(
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

	return [
		p0[0] + frac * (p1[0] - p0[0]),
		p0[1] + frac * (p1[1] - p0[1]),
	]
}

function sliceLineString(
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

function formatReplayTime(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = seconds % 60
	if (mins > 0) {
		return `${mins}:${secs.toString().padStart(2, "0")}`
	}
	return `0:${secs.toString().padStart(2, "0")}`
}
