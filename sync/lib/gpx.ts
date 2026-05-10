import type { RideActivity } from "../../src/lib/ridelog-schema"
import type { RoutePoint } from "./types"

export function buildGpx(activity: RideActivity, points: RoutePoint[]) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="RideLog" xmlns="http://www.topografix.com/GPX/1/1">',
    "  <trk>",
    `    <name>${escapeXml(activity.title)}</name>`,
    "    <type>Ride</type>",
    "    <trkseg>",
    ...points.map(pointToGpx),
    "    </trkseg>",
    "  </trk>",
    "</gpx>",
  ]
  return `${lines.join("\n")}\n`
}

function pointToGpx(point: RoutePoint) {
  const attrs = `lat="${point.latitude}" lon="${point.longitude}"`
  const values = [`      <trkpt ${attrs}>`]
  if (point.altitude !== undefined) {
    values.push(`        <ele>${point.altitude}</ele>`)
  }
  if (point.time) {
    values.push(`        <time>${point.time}</time>`)
  }
  values.push("      </trkpt>")
  return values.join("\n")
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
