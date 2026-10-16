import type { EventHistory, HistoryEvent, HistoryRun } from '../api/historyTypes.js'
import type { TrafficEvent } from '../api/types.js'
import { eventAnchor } from './eventAnchor.js'
import { hasEnded, isClosure, isUpcoming } from './eventStatus.js'

// Keeps a compact record of which QLDTraffic events were in effect at each
// read of the feed, so the app can replay the last 48 hours. Each run adds
// nothing but the run itself and the versions it saw; nothing is interpolated
// between runs. Free of browser-only code: the server (api/) records runs and
// the browser (src/lib/timeline.ts) reads them back.

/** How far back the record reaches. */
export const HISTORY_WINDOW_MS = 48 * 60 * 60_000
/** Runs kept at most: 48 hours of 5-minute runs, with room for a few extra reads. */
export const MAX_RUNS = 600
/** The stored JSON's size cap: older runs go first when it is reached. */
export const MAX_BYTES = 900_000

export interface HistoryLimits {
  windowMs: number
  maxRuns: number
  maxBytes: number
}
export const DEFAULT_LIMITS: HistoryLimits = { windowMs: HISTORY_WINDOW_MS, maxRuns: MAX_RUNS, maxBytes: MAX_BYTES }

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

/** One key per published version of an event: its id and its `last_updated` stamp. */
export function versionKey(e: TrafficEvent): string {
  return `${e.properties.id}@${ms(e.properties.last_updated) ?? ''}`
}

/** The compact record of an event, without its spans. */
export function toHistoryEvent(e: TrafficEvent): Omit<HistoryEvent, 'spans'> {
  const p = e.properties
  return {
    id: p.id,
    published: ms(p.published),
    updated: ms(p.last_updated),
    type: p.event_type,
    priority: p.event_priority,
    closure: isClosure(e),
    anchor: eventAnchor(e),
    road: p.road_summary?.road_name?.trim() || null,
  }
}

export const EMPTY_HISTORY: EventHistory = { runs: [], events: {} }

/**
 * Records one read of the feed at `now`: the events in effect (as the official
 * site counts them: not upcoming, not past their end) each get this run added
 * to their spans, and the run joins the list. Then the record is pruned.
 */
export function recordRun(history: EventHistory, events: TrafficEvent[], now: number, feedPublished: string | null = null, limits = DEFAULT_LIMITS): EventHistory {
  const last = history.runs.at(-1)
  if (last && now <= last.at) return history
  const versions = { ...history.events }
  let count = 0
  for (const e of events) {
    if (isUpcoming(e, now) || hasEnded(e, now)) continue
    count++
    const key = versionKey(e)
    const before = versions[key]
    const spans = before ? before.spans.map(([a, b]) => [a, b] as [number, number]) : []
    const tail = spans.at(-1)
    // Seen at the previous run too: the same span continues. Otherwise a new one starts here.
    if (tail && last && tail[1] === last.at) tail[1] = now
    else spans.push([now, now])
    versions[key] = { ...(before ?? toHistoryEvent(e)), spans }
  }
  const run: HistoryRun = { at: now, published: ms(feedPublished), count }
  return prune({ runs: [...history.runs, run], events: versions }, now, limits)
}

/** Drops runs older than the window or beyond the caps, and clips every version's spans to the runs kept. */
export function prune(history: EventHistory, now: number, limits = DEFAULT_LIMITS): EventHistory {
  let runs = history.runs.filter((r) => now - r.at <= limits.windowMs).slice(-limits.maxRuns)
  let out = clip(history, runs)
  while (runs.length > 1 && JSON.stringify(out).length > limits.maxBytes) {
    runs = runs.slice(1)
    out = clip(history, runs)
  }
  return out
}

function clip(history: EventHistory, runs: HistoryRun[]): EventHistory {
  const floor = runs[0]?.at ?? Infinity
  const events: Record<string, HistoryEvent> = {}
  for (const [key, v] of Object.entries(history.events)) {
    const spans = v.spans.flatMap(([a, b]) => (b < floor ? [] : [[Math.max(a, floor), b] as [number, number]]))
    if (spans.length) events[key] = { ...v, spans }
  }
  return { runs, events }
}

/** The run nearest to `t` without being after it, or null when the record does not reach back that far. */
export function runAtOrBefore(runs: HistoryRun[], t: number): HistoryRun | null {
  let hit: HistoryRun | null = null
  for (const r of runs) {
    if (r.at > t) break
    hit = r
  }
  return hit
}

/** The event versions in effect at `run`, as recorded then. */
export function inEffectAt(history: EventHistory, run: HistoryRun): HistoryEvent[] {
  return Object.values(history.events).filter((v) => v.spans.some(([a, b]) => a <= run.at && run.at <= b))
}
