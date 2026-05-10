import {
  Bicycle01Icon,
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  RoadIcon,
  Search01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { RideMap } from "./components/ride-map"
import {
  activitiesFileSchema,
  type RideActivity,
  type RideSummary,
  summarySchema,
} from "./lib/ridelog-schema"

type LoadState =
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

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [activitiesResponse, summaryResponse] = await Promise.all([
          fetch("/data/activities.json"),
          fetch("/data/summary.json"),
        ])
        if (!activitiesResponse.ok || !summaryResponse.ok) {
          setLoadState({ status: "empty", activities: [], summary: null })
          return
        }
        const activitiesFile = activitiesFileSchema.parse(
          await activitiesResponse.json()
        )
        const summary = summarySchema.parse(await summaryResponse.json())
        if (cancelled) {
          return
        }
        setLoadState({
          status: activitiesFile.activities.length > 0 ? "ready" : "empty",
          activities: activitiesFile.activities,
          summary,
        })
        setSelectedId(activitiesFile.activities[0]?.id ?? null)
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
          <Header summary={summary} status={loadState.status} />
          <Stats summary={summary} />
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

function Header({
  summary,
  status,
}: {
  summary: RideSummary
  status: LoadState["status"]
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">RideLog</h1>
        <p className="text-sm text-muted-foreground">
          Keep to Strava cycling sync
        </p>
      </div>
      <Badge
        variant={status === "ready" ? "default" : "secondary"}
        className="gap-1.5"
      >
        <HugeiconsIcon icon={Upload04Icon} size={14} />
        {summary.sync.lastSyncedAt
          ? formatDate(summary.sync.lastSyncedAt)
          : "Local"}
      </Badge>
    </div>
  )
}

function Stats({ summary }: { summary: RideSummary }) {
  const stats = [
    {
      label: "Rides",
      value: summary.totals.rides.toLocaleString(),
      icon: Bicycle01Icon,
    },
    {
      label: "Distance",
      value: formatDistance(summary.totals.distanceMeters),
      icon: RoadIcon,
    },
    {
      label: "Moving",
      value: formatDuration(summary.totals.movingTimeSeconds),
      icon: Clock01Icon,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <Card key={stat.label} className="rounded-md">
          <CardContent className="p-3">
            <div className="mb-2 text-muted-foreground">
              <HugeiconsIcon icon={stat.icon} size={18} />
            </div>
            <div className="truncate text-lg font-semibold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RideList({
  activities,
  query,
  selectedId,
  onQueryChange,
  onSelect,
}: {
  activities: RideActivity[]
  query: string
  selectedId: string | undefined
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col rounded-md">
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center justify-between text-base">
          Rides
          <Badge variant="outline">{activities.length}</Badge>
        </CardTitle>
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search rides"
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="scrollbar-dark min-h-0 flex-1 space-y-2 overflow-auto p-3 pt-0">
        {activities.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No public ride data generated yet.
          </div>
        ) : (
          activities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => onSelect(activity.id)}
              className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                selectedId === activity.id
                  ? "border-primary bg-muted"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {activity.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={Calendar03Icon} size={14} />
                    {formatDate(activity.startTime)}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold">
                  {formatDistance(activity.distanceMeters)}
                </div>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function RideDetail({
  activity,
  status,
  error,
}: {
  activity: RideActivity | undefined
  status: LoadState["status"]
  error: string | undefined
}) {
  if (status === "error") {
    return (
      <PanelMessage
        title="Data error"
        message={error ?? "Unable to load generated data."}
      />
    )
  }
  if (!activity) {
    return (
      <PanelMessage
        title="No rides"
        message="Run the sync pipeline or generate public data to populate the dashboard."
      />
    )
  }

  return (
    <Card className="rounded-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{activity.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(activity.startTime)}
            </p>
          </div>
          <Badge variant={activity.route ? "default" : "secondary"}>
            {activity.route ? "Mapped" : "Route hidden"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Distance"
            value={formatDistance(activity.distanceMeters)}
          />
          <Metric
            label="Moving"
            value={formatDuration(activity.movingTimeSeconds ?? 0)}
          />
          <Metric
            label="Avg speed"
            value={formatSpeed(activity.averageSpeedMps)}
          />
          <Metric
            label="Elevation"
            value={`${Math.round(activity.elevationGainMeters ?? 0)} m`}
          />
        </div>
        <Separator />
        <div className="space-y-3 text-sm">
          <MetaRow
            icon={Location01Icon}
            label="Location"
            value={
              activity.location?.name || activity.location?.region || "Unknown"
            }
          />
          <MetaRow
            icon={Upload04Icon}
            label="Source"
            value={`${activity.source.provider} ${activity.source.activityId}`}
          />
          <MetaRow
            icon={RoadIcon}
            label="Route points"
            value={
              activity.route?.pointCount
                ? activity.route.pointCount.toLocaleString()
                : "Hidden"
            }
          />
        </div>
        {activity.destinations?.some(
          (destination) => destination.provider === "strava"
        ) ? (
          <a
            className={buttonVariants({ className: "w-full" })}
            href={
              activity.destinations.find(
                (destination) => destination.provider === "strava"
              )?.url
            }
            target="_blank"
            rel="noreferrer"
          >
            Open in Strava
          </a>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: unknown
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <HugeiconsIcon
        icon={icon as never}
        size={16}
        className="text-muted-foreground"
      />
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  )
}

function PanelMessage({ title, message }: { title: string; message: string }) {
  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  )
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(meters >= 100_000 ? 0 : 1)} km`
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function formatSpeed(speed: number | undefined) {
  return speed ? `${(speed * 3.6).toFixed(1)} km/h` : "n/a"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default App
