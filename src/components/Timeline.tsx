import { Button } from '@cloudflare/kumo'
import { BroadcastIcon, ClockCounterClockwiseIcon, PauseIcon, PlayIcon, XIcon } from '@phosphor-icons/react'
import type { HistoryResponse, HistoryRun } from '../api/historyTypes'
import type { TimelineState } from '../hooks/useTimeline'
import { replayLabel, TIMELINE_WINDOW_MS } from '../lib/timeline'
import { brisbaneDayClock as dayTime, brisbaneClock as timeOnly } from '../lib/aest'

// The 48-hour scrubber. It chooses a time; what shows at that time is decided
// by src/lib/timeline.ts, and only from what was published by then.

const speedLabel = (speed: number) => `${speed / 60_000} min/s`
/** Whether a read and the chosen time fall in different minutes, so naming both says something. */
const earlierMinute = (run: HistoryRun, at: number) => timeOnly.format(run.at) !== timeOnly.format(at)

/** The bar: a slider over the last 48 hours, play at a few speeds, and Live to return to now. */
export function Timeline({
  now,
  state,
  history,
  error,
  run,
  onClose,
  className = '',
}: {
  now: number
  state: TimelineState
  history: HistoryResponse | null
  error: string | null
  /** The feed read the events are shown from at the chosen time, or null when the record does not reach it. */
  run: HistoryRun | null
  onClose?: () => void
  className?: string
}) {
  const start = now - TIMELINE_WINDOW_MS
  const at = state.at ?? now
  const first = history?.runs[0]
  const reach = first ? Math.max(0, Math.min(1, (first.at - start) / TIMELINE_WINDOW_MS)) : 1
  return (
    <div className={`grid gap-1.5 rounded-xl bg-kumo-base px-3 py-2 text-sm shadow-md ring ring-kumo-line ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 font-medium">
          <ClockCounterClockwiseIcon aria-hidden />
          {state.at == null ? 'Live' : dayTime.format(at)}
        </span>
        <span className="text-xs text-kumo-subtle">
          {state.at == null
            ? 'Drag back to replay the last 48 hours as it was published.'
            : run
              ? `Road events as of the ${timeOnly.format(run.at)} read${earlierMinute(run, at) ? `, the last before ${timeOnly.format(at)}` : ''} · ${run.count} in effect`
              : history
                ? `No read of the road events that far back${first ? `: the record starts ${dayTime.format(first.at)}` : ''}.`
                : error
                  ? `Road event history unavailable: ${error}`
                  : 'Loading the road event history…'}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {state.playing ? (
            <Button size="xs" variant="secondary" icon={<PauseIcon weight="fill" />} onClick={state.pause}>
              Pause
            </Button>
          ) : (
            <Button size="xs" variant="secondary" icon={<PlayIcon weight="fill" />} onClick={state.play} title="Play forward from the chosen time, or from 48 hours ago">
              Play
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={state.faster} title="Replay speed: replayed minutes per real second" className="tabular-nums">
            {speedLabel(state.speed)}
          </Button>
          <Button size="xs" variant={state.at == null ? 'ghost' : 'primary'} icon={<BroadcastIcon />} onClick={state.live} disabled={state.at == null}>
            Live
          </Button>
          {onClose && <Button size="sm" variant="ghost" shape="square" aria-label="Close the timeline" icon={<XIcon />} onClick={onClose} />}
        </span>
      </div>
      <div className="relative">
        {/* The part of the window the record does not reach, drawn faded under the slider. */}
        {reach > 0 && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 rounded-l bg-kumo-tint" style={{ width: `${reach * 100}%` }} />}
        <input
          type="range"
          min={start}
          max={now}
          step={60_000}
          value={at}
          aria-label="Time to show"
          aria-valuetext={state.at == null ? 'Live' : dayTime.format(at)}
          onChange={(e) => state.seek(Number(e.target.value))}
          className="relative h-1.5 w-full cursor-pointer accent-[var(--color-kumo-brand)]"
        />
      </div>
      <div className="flex justify-between text-xs text-kumo-subtle tabular-nums">
        <span>{dayTime.format(start)}</span>
        <span>{history && history.kept === 'memory' ? `Record since ${dayTime.format(first?.at ?? now)} (no store)` : history ? `${history.runs.length} reads kept` : ''}</span>
        <span>Now</span>
      </div>
    </div>
  )
}

/** The notice shown over replayed content: what time it is, and that it is not live. */
export function ReplayBanner({ at, run, className = '' }: { at: number; run: HistoryRun | null; className?: string }) {
  return (
    <div role="status" className={`rounded-full bg-kumo-warning-tint px-3 py-1 text-sm font-medium text-kumo-default shadow-md ring ring-kumo-warning ${className}`}>
      {replayLabel(at)}
      {run && earlierMinute(run, at) && <span className="font-normal"> · events as of {timeOnly.format(run.at)}</span>}
    </div>
  )
}
