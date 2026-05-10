import { Upload04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"
import { RideMap } from "@/components/ride-map"
import { Badge } from "@/components/ui/badge"
import { RideDetail } from "@/features/rides/ride-detail"
import { RideList } from "@/features/rides/ride-list"
import { RideStats } from "@/features/rides/ride-stats"
import { useRidesData } from "@/hooks/use-rides-data"
import { formatDate } from "@/lib/format"

export function Dashboard() {
  const { loadState, activities, summary } = useRidesData()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return activities
    }
    return activities.filter((activity) => {
      const haystack = [
        activity.title,
        activity.location?.name,
        activity.location?.region,
        activity.startTime,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [activities, query])

  const selected =
    activities.find((activity) => activity.id === selectedId) ?? filtered[0]

  return (
    <main className="h-svh overflow-hidden bg-background text-foreground">
      <div className="grid h-full w-full gap-4 p-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                RideLog
              </h1>
              <p className="text-sm text-muted-foreground">
                Keep to Strava cycling sync
              </p>
            </div>
            <Badge
              variant={loadState.status === "ready" ? "default" : "secondary"}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={Upload04Icon} size={14} />
              {summary.sync.lastSyncedAt
                ? formatDate(summary.sync.lastSyncedAt)
                : "Local"}
            </Badge>
          </div>
          <RideStats summary={summary} />
          <RideList
            activities={filtered}
            query={query}
            selectedId={selected?.id}
            onQueryChange={setQuery}
            onSelect={setSelectedId}
          />
        </aside>

        <section className="min-h-0 min-w-0">
          <RideMap activity={selected} className="h-full" />
        </section>

        <section className="min-h-0 min-w-0 overflow-auto scrollbar-dark">
          <RideDetail
            activity={selected}
            status={loadState.status}
            error={loadState.status === "error" ? loadState.message : undefined}
          />
        </section>
      </div>
    </main>
  )
}
