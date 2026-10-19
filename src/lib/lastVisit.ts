import type { TrafficEvent } from '../api/types.js'

// Which road events weren't listed the last time this browser read the feed,
// so the list can mark them "New". Only QLDTraffic's own event ids are kept,
// in this browser, with the time of that read.

export interface Visit {
  /** When the app last read road events in this browser. */
  at: number
  /** The event ids QLDTraffic listed then. */
  ids: number[]
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** A stored visit, or null for nothing stored or anything of the wrong shape. */
export function parseVisit(json: unknown): Visit | null {
  if (!json || typeof json !== 'object') return null
  const v = json as Record<string, unknown>
  if (!isNumber(v.at) || !Array.isArray(v.ids)) return null
  return { at: v.at, ids: v.ids.filter(isNumber) }
}

/** The visit to store after a read: the events listed now, at that time. */
export function visitOf(events: TrafficEvent[], at: number): Visit {
  return { at, ids: events.map((e) => e.properties.id) }
}

/** Ids of the events not listed at `visit`; none when there was no earlier visit, so a first visit marks nothing new. */
export function newSince(visit: Visit | null, events: TrafficEvent[]): Set<number> {
  if (!visit) return new Set()
  const before = new Set(visit.ids)
  return new Set(events.map((e) => e.properties.id).filter((id) => !before.has(id)))
}
