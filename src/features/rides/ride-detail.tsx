import {
  Location01Icon,
  RoadIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatSpeed,
} from "@/lib/format"
import type { RideActivity } from "@/lib/ridelog-schema"

type RideDetailProps = {
  activity: RideActivity | undefined
  status: "loading" | "ready" | "empty" | "error"
  error?: string
}

export function RideDetail({ activity, status, error }: RideDetailProps) {
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

  const stravaDestination = activity.destinations?.find(
    (destination) => destination.provider === "strava"
  )

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
        {stravaDestination ? (
          <a
            className={buttonVariants({ className: "w-full" })}
            href={stravaDestination.url}
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
