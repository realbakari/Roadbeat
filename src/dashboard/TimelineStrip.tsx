import { useMemo } from 'react'
import { Timeline } from '../components/Timeline'
import { useEventHistory, useTimeline } from '../hooks/useTimeline'
import type { NewsSnapshot } from '../api/newsTypes'
import { groupStories } from '../lib/newsStories'
import { countEvents, replayAt } from '../lib/timeline'

const dayTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', hour: 'numeric', minute: '2-digit' })
const timeOnly = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })

/**
 * The dashboard's replay strip: the 48-hour scrubber, with the road events in
 * effect at the chosen time (as of the nearest feed read before it) and the
 * headlines published by then. The other panels stay live.
 */
export function TimelineStrip({ now, news }: { now: number; news: NewsSnapshot | null }) {
  const state = useTimeline()
  const { history, error } = useEventHistory(true)
  const replay = useMemo(() => (state.at == null ? null : replayAt(state.at, history, news?.items ?? [], [])), [state.at, history, news])
  const counts = replay ? countEvents(replay.events) : null
  const stories = useMemo(() => (replay ? groupStories(replay.items).slice(0, 4) : []), [replay])
  return (
    <section aria-label="Replay the last 48 hours" className="grid shrink-0 gap-2">
      <Timeline now={now} state={state} history={history} error={error} run={replay?.run ?? null} className="shadow-none" />
      {replay && (
        <div className="grid gap-2 rounded-xl bg-kumo-base px-4 py-3 text-sm ring ring-kumo-line md:grid-cols-[auto_1fr] md:items-start md:gap-6">
          <div className="grid gap-0.5">
            <span className="text-xs font-medium text-kumo-warning">Showing {dayTime.format(replay.at)} · as published then · not live</span>
            {counts && replay.run ? (
              <span className="flex flex-wrap gap-x-4 tabular-nums">
                <span>
                  <span className="text-2xl font-semibold text-kumo-strong">{counts.total}</span> road events in effect
                </span>
                <span>
                  <span className="text-2xl font-semibold text-kumo-strong">{counts.closures}</span> closures
                </span>
                <span>
                  <span className="text-2xl font-semibold text-kumo-strong">{counts.crashes}</span> crashes
                </span>
              </span>
            ) : (
              <span className="text-kumo-subtle">No read of the road events that far back.</span>
            )}
            {replay.run && <span className="text-xs text-kumo-subtle">QLDTraffic as read at {timeOnly.format(replay.run.at)}.</span>}
          </div>
          <ul className="grid gap-1 md:grid-cols-2">
            {stories.map((s) => (
              <li key={s.id} className="truncate">
                <a href={`/#news/${encodeURIComponent(s.id)}`} className="hover:underline">
                  <span className="text-kumo-subtle tabular-nums">{timeOnly.format(s.first)}</span> {s.items[0].title}
                </a>
              </li>
            ))}
            {!stories.length && <li className="text-kumo-subtle">{news ? 'No story had been published by then in the last 48 hours.' : 'Loading the news monitor…'}</li>}
          </ul>
        </div>
      )}
    </section>
  )
}
