import { PauseIcon, PlayIcon, ReplayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { formatReplayTime } from "@/lib/format"

const SPEEDS = [1, 2, 4] as const

export type ReplayControlsProps = {
  isPlaying: boolean
  progress: number
  speedIndex: number
  onTogglePlay: () => void
  onSetProgress: (progress: number) => void
  onSetSpeedIndex: (index: number) => void
  onReset: () => void
}

export function ReplayControls({
  isPlaying,
  progress,
  speedIndex,
  onTogglePlay,
  onSetProgress,
  onSetSpeedIndex,
  onReset,
}: ReplayControlsProps) {
  const speed = SPEEDS[speedIndex]
  const totalSeconds = 15
  const currentSeconds = Math.round(progress * totalSeconds)

  return (
    <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-lg border bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={14} />
      </Button>

      <Slider
        value={[Math.round(progress * 100)]}
        min={0}
        max={100}
        step={1}
        onValueChange={(value) => {
          const v = Array.isArray(value) ? value[0] : value
          onSetProgress(v / 100)
        }}
        className="flex-1"
      />

      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatReplayTime(currentSeconds)} / {formatReplayTime(totalSeconds)}
      </span>

      <Button
        size="xs"
        variant="ghost"
        className="tabular-nums"
        onClick={() => onSetSpeedIndex((speedIndex + 1) % SPEEDS.length)}
      >
        {speed}x
      </Button>

      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onReset}
        aria-label="Reset"
      >
        <HugeiconsIcon icon={ReplayIcon} size={14} />
      </Button>
    </div>
  )
}
