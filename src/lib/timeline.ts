import type { Gauge } from '../api/gaugeTypes'
import type { EventHistory, HistoryEvent, HistoryRun } from '../api/historyTypes'
import type { NewsItem } from '../api/newsTypes'
import type { TrafficEvent } from '../api/types'
import { brisbaneDayClock } from './aest'
import { HISTORY_WINDOW_MS, inEffectAt, runAtOrBefore } from './eventHistory'

// Replays what the official sources had published by a chosen time. The rule
// is the same as everywhere else in the app: a replay shows only what was
// published, each thing at its publisher's own time, and fills in nothing.
// Road events come from the server's record of feed reads, so they are shown
// as of the nearest read at or before the time, never a guess between reads.

/** How far back the scrubber reaches: the history and the news monitor both keep 48 hours. */
export const TIMELINE_WINDOW_MS = HISTORY_WINDOW_MS

/** Replay speeds, in replayed milliseconds per real second: a minute, five minutes or a quarter hour per second. */
export const SPEEDS = [60_000, 5 * 60_000, 15 * 60_000] as const
export type Speed = (typeof SPEEDS)[number]

export interface Replay {
  /** The chosen time. */
  at: number
  /** The feed read the events are shown from: the nearest run at or before `at`, or null when the record does not reach back that far. */
  run: HistoryRun | null
  /** Event versions in effect at that read. Empty when `run` is null. */
  events: HistoryEvent[]
  /** News monitor items the publisher had dated by `at`. */
  items: NewsItem[]
  /** Each gauge with only the readings taken by `at`. */
  gauges: Gauge[]
}

/**
 * What was in effect or published by `t`. Events come from the nearest run at
 * or before `t`; a time between runs shows the earlier run, and `run` says
 * which, so the UI can say "as of 10:35, the last read before 10:40".
 */
export function replayAt(t: number, history: EventHistory | null, items: NewsItem[], gauges: Gauge[]): Replay {
  const run = history ? runAtOrBefore(history.runs, t) : null
  return {
    at: t,
    run,
    events: run && history ? inEffectAt(history, run) : [],
    items: items.filter((it) => it.published <= t),
    gauges: gauges.map((g) => ({ ...g, readings: g.readings.filter((r) => r.time <= t) })),
  }
}

/**
 * A recorded event version as the map draws events: a point at its anchor and
 * the properties the record kept, with the rest null. The map's icons, colours
 * and labels read only these fields.
 */
export function asTrafficEvent(v: HistoryEvent): TrafficEvent {
  return {
    type: 'Feature',
    geometry: v.anchor ? { type: 'Point', coordinates: v.anchor } : null,
    properties: {
      id: v.id,
      status: 'Published',
      published: v.published == null ? null : new Date(v.published).toISOString(),
      source: null,
      url: '',
      event_type: v.type,
      event_subtype: null,
      event_due_to: null,
      impact: v.closure ? { direction: null, towards: null, impact_type: 'Closures', impact_subtype: null, delay: null } : null,
      duration: null,
      event_priority: v.priority,
      description: null,
      advice: null,
      information: null,
      road_summary: v.road ? { road_name: v.road, locality: null, postcode: null, local_government_area: null, district: null } : null,
      last_updated: v.updated == null ? null : new Date(v.updated).toISOString(),
      next_inspection: null,
      web_link: null,
    },
  }
}

/** Counts a replay's events by what the record says about them. */
export function countEvents(events: HistoryEvent[]): { total: number; closures: number; crashes: number } {
  return {
    total: events.length,
    closures: events.filter((e) => e.closure).length,
    crashes: events.filter((e) => e.type === 'Crash').length,
  }
}

/** Keeps a chosen time inside the window: no earlier than 48 hours ago, no later than now. */
export function clampTime(t: number, now: number): number {
  return Math.min(now, Math.max(now - TIMELINE_WINDOW_MS, t))
}

/** Where the time step lands after `elapsedMs` of play at `speed`: null once it reaches now, which returns the view to live. */
export function stepTime(t: number, speed: Speed, elapsedMs: number, now: number): number | null {
  const next = t + (speed * elapsedMs) / 1000
  return next >= now ? null : next
}

/** What a replay says it shows, the same on the map's banner and the dashboard's strip. */
export function replayLabel(at: number): string {
  return `Showing ${brisbaneDayClock.format(at)} · as published then · not live`
}
