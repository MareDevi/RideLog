import type { Bounds, Coordinate } from "../../src/lib/ridelog-schema"
import type { RoutePoint } from "./types"

const PI = Math.PI
const EARTH_RADIUS_METERS = 6_371_000
const A = 6378245.0
const EE = 0.006693421622965943

export function gcj02ToWgs84(latitude: number, longitude: number): Coordinate {
  if (outsideChina(latitude, longitude)) {
    return [longitude, latitude]
  }

  const dLat = transformLat(longitude - 105.0, latitude - 35.0)
  const dLng = transformLng(longitude - 105.0, latitude - 35.0)
  const radLat = (latitude / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  const adjustedLat =
    (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  const adjustedLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  const mgLat = latitude + adjustedLat
  const mgLng = longitude + adjustedLng

  return [longitude * 2 - mgLng, latitude * 2 - mgLat]
}

export function coordinatesFromPoints(points: RoutePoint[]): Coordinate[] {
  return points.map((point) => [point.longitude, point.latitude])
}

export function boundsForCoordinates(
  coordinates: Coordinate[]
): Bounds | undefined {
  if (coordinates.length === 0) {
    return undefined
  }

  let west = coordinates[0][0]
  let east = coordinates[0][0]
  let south = coordinates[0][1]
  let north = coordinates[0][1]

  for (const [longitude, latitude] of coordinates) {
    west = Math.min(west, longitude)
    east = Math.max(east, longitude)
    south = Math.min(south, latitude)
    north = Math.max(north, latitude)
  }

  return { west, south, east, north }
}

export function trimRoute(
  points: RoutePoint[],
  trimStartMeters: number,
  trimEndMeters: number
): RoutePoint[] {
  let trimmed = trimByDistanceFromStart(points, trimStartMeters)
  trimmed = trimByDistanceFromEnd(trimmed, trimEndMeters)
  return trimmed.length >= 2 ? trimmed : []
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const lat1 = toRadians(a[1])
  const lat2 = toRadians(b[1])
  const dLat = toRadians(b[1] - a[1])
  const dLng = toRadians(b[0] - a[0])
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function trimByDistanceFromStart(
  points: RoutePoint[],
  meters: number
): RoutePoint[] {
  if (meters <= 0 || points.length < 2) {
    return points
  }

  let traveled = 0
  for (let index = 1; index < points.length; index += 1) {
    traveled += distanceMeters(
      pointToCoordinate(points[index - 1]),
      pointToCoordinate(points[index])
    )
    if (traveled >= meters) {
      return points.slice(index)
    }
  }
  return []
}

function trimByDistanceFromEnd(
  points: RoutePoint[],
  meters: number
): RoutePoint[] {
  if (meters <= 0 || points.length < 2) {
    return points
  }

  let traveled = 0
  for (let index = points.length - 2; index >= 0; index -= 1) {
    traveled += distanceMeters(
      pointToCoordinate(points[index + 1]),
      pointToCoordinate(points[index])
    )
    if (traveled >= meters) {
      return points.slice(0, index + 1)
    }
  }
  return []
}

function pointToCoordinate(point: RoutePoint): Coordinate {
  return [point.longitude, point.latitude]
}

function toRadians(value: number) {
  return (value * PI) / 180
}

function outsideChina(latitude: number, longitude: number) {
  return (
    longitude < 72.004 ||
    longitude > 137.8347 ||
    latitude < 0.8293 ||
    latitude > 55.8271
  )
}

function transformLat(x: number, y: number) {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x))
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0
  ret +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0
  return ret
}

function transformLng(x: number, y: number) {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x))
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0
  ret +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0
  return ret
}
