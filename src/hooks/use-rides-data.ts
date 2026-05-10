import { useEffect, useState } from "react"
import {
  activitiesFileSchema,
  type RideActivity,
  type RideSummary,
  summarySchema,
} from "@/lib/ridelog-schema"

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; activities: RideActivity[]; summary: RideSummary }
  | { status: "empty"; activities: RideActivity[]; summary: RideSummary | null }
  | { status: "error"; message: string }

const EMPTY_SUMMARY: RideSummary = {
  version: 1,
  generatedAt: new Date(0).toISOString(),
  totals: {
    rides: 0,
    distanceMeters: 0,
    movingTimeSeconds: 0,
    elevationGainMeters: 0,
  },
  years: [],
  sync: {
    source: "keep",
    destination: "strava",
    routePrivacy: {
      hideRoutes: false,
      trimStartMeters: 0,
      trimEndMeters: 0,
    },
  },
}

const cache: {
  activities: RideActivity[] | null
  summary: RideSummary | null
} = {
  activities: null,
  summary: null,
}

export function useRidesData(): {
  loadState: LoadState
  activities: RideActivity[]
  summary: RideSummary
} {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        if (cache.activities && cache.summary) {
          if (!cancelled) {
            setLoadState({
              status: cache.activities.length > 0 ? "ready" : "empty",
              activities: cache.activities,
              summary: cache.summary,
            })
          }
          return
        }

        const [activitiesResponse, summaryResponse] = await Promise.all([
          fetch("/data/activities.json"),
          fetch("/data/summary.json"),
        ])
        if (!activitiesResponse.ok || !summaryResponse.ok) {
          if (!cancelled) {
            setLoadState({ status: "empty", activities: [], summary: null })
          }
          return
        }
        const activitiesFile = activitiesFileSchema.parse(
          await activitiesResponse.json()
        )
        const summary = summarySchema.parse(await summaryResponse.json())

        cache.activities = activitiesFile.activities
        cache.summary = summary

        if (cancelled) {
          return
        }
        setLoadState({
          status: activitiesFile.activities.length > 0 ? "ready" : "empty",
          activities: activitiesFile.activities,
          summary,
        })
      } catch (error) {
        if (!cancelled) {
          setLoadState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load ride data",
          })
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const activities =
    loadState.status === "ready" || loadState.status === "empty"
      ? loadState.activities
      : []
  const summary =
    (loadState.status === "ready" || loadState.status === "empty"
      ? loadState.summary
      : null) ?? EMPTY_SUMMARY

  return { loadState, activities, summary }
}
