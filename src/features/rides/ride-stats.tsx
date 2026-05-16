import {
  Bicycle01Icon,
  Clock01Icon,
  RoadIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card, CardContent } from "@/components/ui/card"
import { formatDistance, formatDuration } from "@/lib/format"
import type { RideSummary } from "@/lib/ridelog-schema"

export function RideStats({ summary }: { summary: RideSummary }) {
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
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {stats.map((stat) => (
        <Card key={stat.label} className="rounded-md">
          <CardContent className="p-3">
            <div className="mb-2 text-muted-foreground">
              <HugeiconsIcon icon={stat.icon} size={18} />
            </div>
            <div className="truncate text-base font-semibold sm:text-lg">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
