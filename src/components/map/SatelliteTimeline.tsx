import { Button, Text } from '@cloudflare/kumo'
import { CaretLeftIcon, CaretRightIcon, PauseIcon, PlayIcon, SkipForwardIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { aestWithAge } from '../../lib/aest'
import { stepFrame } from '../../lib/frames'

/** How long each frame shows while playing. */
const FRAME_MS = 800

interface Props {
  /** The images the source lists for the last few hours, oldest first. */
  frames: string[]
  /** The frame shown, or null to follow the newest. */
  current: string | null
  onChange: (frame: string | null) => void
  now: number
  /** Who lists the frames, for the label. */
  source: string
}

/**
 * Play, step and jump to the newest of a live satellite image's frames. Only
 * frames the source lists are shown, each with its own time in AEST; nothing
 * is drawn between them.
 */
export function SatelliteTimeline({ frames, current, onChange, now, source }: Props) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => onChange(stepFrame(frames, current, 1)), FRAME_MS)
    return () => clearInterval(id)
  }, [playing, frames, current, onChange])
  if (frames.length < 2) return null
  const shown = current ?? frames[frames.length - 1]
  const index = frames.indexOf(shown)
  const step = (d: number) => {
    setPlaying(false)
    onChange(stepFrame(frames, current, d))
  }
  return (
    <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-xl bg-kumo-base p-1.5 shadow-md ring ring-kumo-line" role="group" aria-label="Satellite frames">
      <Button size="sm" variant="ghost" shape="square" aria-label="Previous frame" icon={<CaretLeftIcon />} onClick={() => step(-1)} className="max-md:size-11" />
      <Button
        size="sm"
        variant="ghost"
        shape="square"
        aria-label={playing ? 'Pause' : 'Play the last frames'}
        icon={playing ? <PauseIcon /> : <PlayIcon />}
        onClick={() => setPlaying((p) => !p)}
        className="max-md:size-11"
      />
      <Button size="sm" variant="ghost" shape="square" aria-label="Next frame" icon={<CaretRightIcon />} onClick={() => step(1)} className="max-md:size-11" />
      <div className="grid min-w-0 px-1 md:whitespace-nowrap" aria-live="off">
        <Text size="xs" bold>
          <span className="tabular-nums">{aestWithAge(Date.parse(shown), now)}</span>
        </Text>
        <Text size="xs" variant="secondary">
          {current == null && !playing ? `Newest from ${source}` : `Frame ${index + 1} of ${frames.length}, as ${source} lists it`}
        </Text>
      </div>
      <Button
        size="sm"
        variant="ghost"
        shape="square"
        aria-label="Jump to the newest frame"
        icon={<SkipForwardIcon />}
        disabled={current == null && !playing}
        onClick={() => {
          setPlaying(false)
          onChange(null)
        }}
        className="max-md:size-11"
      />
    </div>
  )
}
