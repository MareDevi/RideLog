import {
  LayerIcon,
  Route02Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"
import { AllRoutesMap } from "@/components/all-routes-map"
import { RideMap } from "@/components/ride-map"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RideDetail } from "@/features/rides/ride-detail"
import { RideList } from "@/features/rides/ride-list"
import { RideStats } from "@/features/rides/ride-stats"
import { useRidesData } from "@/hooks/use-rides-data"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function Dashboard() {
  const { loadState, activities, summary } = useRidesData()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"single" | "overlay">("single")

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
    <main className="min-h-svh bg-background text-foreground lg:h-svh lg:overflow-hidden">
      <div className="grid min-h-svh w-full gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:h-full lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="flex min-w-0 flex-col gap-4 lg:min-h-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                RideLog
              </h1>
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
            className="max-h-[45svh] lg:max-h-none"
            query={query}
            selectedId={selected?.id}
            onQueryChange={setQuery}
            onSelect={(id) => {
              setSelectedId(id)
              setViewMode("single")
            }}
          />
        </aside>

        <section className="relative flex h-[42svh] min-h-[320px] min-w-0 flex-col gap-2 sm:h-[50svh] sm:min-h-[360px] lg:h-full lg:min-h-0">
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-background/80 p-1 shadow-sm backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                viewMode === "single" && "bg-accent text-accent-foreground"
              )}
              title="Single route"
              onClick={() => setViewMode("single")}
            >
              <HugeiconsIcon icon={Route02Icon} size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                viewMode === "overlay" && "bg-accent text-accent-foreground"
              )}
              title="All routes overlay"
              onClick={() => setViewMode("overlay")}
            >
              <HugeiconsIcon icon={LayerIcon} size={16} />
            </Button>
          </div>
          {viewMode === "single" ? (
            <RideMap activity={selected} className="h-full" />
          ) : (
            <AllRoutesMap className="h-full" />
          )}
        </section>

        <section className="min-w-0 overflow-auto scrollbar-dark max-h-[60svh] lg:min-h-0 lg:max-h-none">
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
