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

  const cycleSpeed = () => onSetSpeedIndex((speedIndex + 1) % SPEEDS.length)

  return (
    <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1.5 rounded-lg border bg-background/85 px-2.5 py-1.5 shadow-sm backdrop-blur sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-center sm:gap-3 sm:px-3 sm:py-2">
      {/* Play + Slider + Time */}
      <div className="flex items-center gap-3">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="shrink-0"
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

        <span className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {formatReplayTime(currentSeconds)} / {formatReplayTime(totalSeconds)}
        </span>
      </div>

      {/* Speed + Reset */}
      <div className="flex items-center justify-end gap-1 sm:gap-3">
        <Button
          size="xs"
          variant="ghost"
          className="tabular-nums"
          onClick={cycleSpeed}
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
    </div>
  )
}
