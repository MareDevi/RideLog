import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createCipheriv } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gzipSync } from "node:zlib"
import { activitiesFileSchema } from "../../src/lib/ridelog-schema"
import {
  extractCyclingIdsFromListResponse,
  normalizeKeepLog,
} from "../adapters/keep"
import { generatePublicData } from "../data-generate"
import {
  assertActivityWriteScope,
  extractDuplicateActivityId,
  runStravaSync,
} from "../strava-sync"
import { decodeKeepPayload } from "./crypto"
import { gcj02ToWgs84 } from "./geo"
import { applyRoutePrivacy } from "./privacy"
import type { StagedActivity } from "./types"

const KEEP_GEO_KEY = Buffer.from("NTZmZTU5OzgyZzpkODczYw==", "base64")
const KEEP_GEO_IV = Buffer.from("MjM0Njg5MjQzMjkyMDMwMA==", "base64")
const originalEnv = { ...process.env }
const originalCwd = process.cwd()

let tempDir: string | undefined

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ridelog-"))
  process.chdir(tempDir)
  process.env = { ...originalEnv }
})

afterEach(async () => {
  process.chdir(originalCwd)
  process.env = { ...originalEnv }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
  }
})

describe("Keep route decoding", () => {
  test("decrypts and inflates geoPoints", () => {
    const encoded = encodeKeepGeo([
      { latitude: 39.9, longitude: 116.4, timestamp: 0 },
    ])
    const decoded = decodeKeepPayload<
      Array<{ latitude: number; longitude: number; timestamp: number }>
    >(encoded, true)
    expect(decoded[0]).toEqual({
      latitude: 39.9,
      longitude: 116.4,
      timestamp: 0,
    })
  })

  test("normalizes cycling logs and drops non-cycling data", () => {
    const payload = keepPayload("outdoorCycling")
    const activity = normalizeKeepLog(payload, "2026-05-10T00:00:00.000Z")
    expect(activity?.id).toBe("keep_9223370441312156007")
    expect(activity?.type).toBe("cycling")
    expect(activity?.privateRoute?.points.length).toBe(3)

    expect(
      normalizeKeepLog(
        keepPayload("outdoorRunning"),
        "2026-05-10T00:00:00.000Z"
      )
    ).toBeNull()
  })

  test("normalizes object-shaped Keep location fields", () => {
    const payload = keepPayload("outdoorCycling")
    payload.data.region = { name: "Beijing" }
    payload.data.city = { name: "Haidian" }

    const activity = normalizeKeepLog(payload, "2026-05-10T00:00:00.000Z")

    expect(activity?.location).toEqual({
      name: "Haidian",
      region: "Beijing",
    })
  })

  test("skips null Keep list stats rows", () => {
    expect(
      extractCyclingIdsFromListResponse({
        data: {
          lastTimestamp: 0,
          records: [
            {
              logs: [
                { stats: null },
                { stats: { id: "keep_valid", isDoubtful: false } },
                { stats: { id: "keep_doubtful", isDoubtful: true } },
              ],
            },
          ],
        },
      })
    ).toEqual(["keep_valid"])
  })
})

describe("route privacy", () => {
  test("converts GCJ-02 coordinates near Beijing to WGS84", () => {
    const [longitude, latitude] = gcj02ToWgs84(39.908823, 116.39747)
    expect(longitude).toBeWithin(116.38, 116.4)
    expect(latitude).toBeWithin(39.9, 39.91)
  })

  test("trims route ends and hides routes", () => {
    const staged = sampleStagedActivity()
    const trimmed = applyRoutePrivacy(
      staged,
      { hideRoutes: false, trimStartMeters: 10, trimEndMeters: 10 },
      "2026-05-10T00:00:00.000Z"
    )
    expect(trimmed.points.length).toBe(2)
    expect(trimmed.activity.route?.bounds).toBeDefined()
    expect(trimmed.activity.privacy.hideRoute).toBe(false)

    const hidden = applyRoutePrivacy(
      staged,
      { hideRoutes: true, trimStartMeters: 0, trimEndMeters: 0 },
      "2026-05-10T00:00:00.000Z"
    )
    expect(hidden.points).toHaveLength(0)
    expect(hidden.activity.route).toBeUndefined()
  })
})

describe("public data generation", () => {
  test("does not replace public data when staged schema validation fails", async () => {
    await mkdir("data/private/staging", { recursive: true })
    await mkdir("public/data", { recursive: true })
    await writeFile(
      "public/data/activities.json",
      `${JSON.stringify({ version: 1, activities: [] })}\n`
    )
    await writeFile(
      "data/private/staging/bad.json",
      `${JSON.stringify({ id: 42 })}\n`
    )

    await expect(generatePublicData()).rejects.toThrow()
    const existing = activitiesFileSchema.parse(
      JSON.parse(await readFile("public/data/activities.json", "utf8"))
    )
    expect(existing.activities).toHaveLength(0)
  })
})

describe("Strava dry-run", () => {
  test("does not call network and skips duplicate uploaded checksums", async () => {
    await mkdir("data/private/staging", { recursive: true })
    await writeFile(
      "data/private/staging/keep_a.json",
      `${JSON.stringify(sampleStagedActivity())}\n`
    )
    globalThis.fetch = (() => {
      throw new Error("network should not be called")
    }) as unknown as typeof fetch

    await runStravaSync(true)
  })

  test("rejects tokens without activity write scope", () => {
    expect(() => assertActivityWriteScope("read activity:read")).toThrow(
      "activity:write"
    )
    expect(() =>
      assertActivityWriteScope("read activity:read activity:write")
    ).not.toThrow()
  })

  test("extracts duplicate Strava activity ids", () => {
    expect(
      extractDuplicateActivityId(
        "keep_1.gpx duplicate of <a href='/activities/14721185470' target='_blank'>Afternoon Ride</a>"
      )
    ).toBe("14721185470")
  })
})

function encodeKeepGeo(value: unknown) {
  const gzipped = gzipSync(JSON.stringify(value))
  const padding = 16 - (gzipped.length % 16)
  const padded = Buffer.concat([gzipped, Buffer.alloc(padding, padding)])
  const cipher = createCipheriv("aes-128-cbc", KEEP_GEO_KEY, KEEP_GEO_IV)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString(
    "base64"
  )
}

function keepPayload(dataType: string) {
  return {
    data: {
      id: "5898009e387e28303988f3b7_9223370441312156007_rn",
      dataType,
      name: "Morning ride",
      startTime: Date.parse("2026-05-10T00:00:00.000Z"),
      endTime: Date.parse("2026-05-10T01:00:00.000Z"),
      duration: 3600,
      distance: 20_000,
      calorie: 420,
      geoPoints: encodeKeepGeo([
        { latitude: 39.908823, longitude: 116.39747, timestamp: 0 },
        { latitude: 39.909, longitude: 116.398, timestamp: 100 },
        { latitude: 39.91, longitude: 116.399, timestamp: 200 },
      ]),
    },
  } as {
    data: {
      id: string
      dataType: string
      name: string
      startTime: number
      endTime: number
      duration: number
      distance: number
      calorie: number
      geoPoints: string
      region?: unknown
      city?: unknown
    }
  }
}

function sampleStagedActivity(): StagedActivity {
  const now = "2026-05-10T00:00:00.000Z"
  return {
    id: "keep_a",
    type: "cycling",
    title: "Sample ride",
    startTime: now,
    distanceMeters: 300,
    movingTimeSeconds: 60,
    source: {
      provider: "keep",
      activityId: "a",
      importedAt: now,
      checksum: "sha256:source",
    },
    privacy: {
      visibility: "public",
      hideRoute: false,
    },
    createdAt: now,
    updatedAt: now,
    privateRoute: {
      points: [
        { longitude: 116.39, latitude: 39.9 },
        { longitude: 116.391, latitude: 39.9 },
        { longitude: 116.392, latitude: 39.9 },
        { longitude: 116.393, latitude: 39.9 },
      ],
      coordinates: [
        [116.39, 39.9],
        [116.391, 39.9],
        [116.392, 39.9],
        [116.393, 39.9],
      ],
      sourceChecksum: "sha256:source",
      routeChecksum: "sha256:route",
    },
  }
}
