import { Calendar03Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { memo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDate, formatDistance } from "@/lib/format"
import type { RideActivity } from "@/lib/ridelog-schema"
import { cn } from "@/lib/utils"

type RideListProps = {
  activities: RideActivity[]
  className?: string
  query: string
  selectedId: string | undefined
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
}

export function RideList({
  activities,
  className,
  query,
  selectedId,
  onQueryChange,
  onSelect,
}: RideListProps) {
  return (
    <Card className={cn("flex min-h-0 flex-1 flex-col rounded-md", className)}>
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
            <RideListItem
              key={activity.id}
              activity={activity}
              isSelected={selectedId === activity.id}
              onSelect={onSelect}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

type RideListItemProps = {
  activity: RideActivity
  isSelected: boolean
  onSelect: (id: string) => void
}

const RideListItem = memo(function RideListItem({
  activity,
  isSelected,
  onSelect,
}: RideListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(activity.id)}
      className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted ${
        isSelected ? "border-primary bg-muted" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{activity.title}</div>
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
  )
})
