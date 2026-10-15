import type { EventType, TrafficEvent } from '../api/types'
import { eventAnchor, distanceKm, type LngLat } from './geo'
import { priorityRank } from './eventMeta'
import { hasEnded, isClosure, isUpcoming } from './eventStatus'

export { hasEnded, isClosure, isUpcoming } from './eventStatus'

export type SortKey = 'priority' | 'recent' | 'nearest'
export type When = 'now' | 'upcoming'

export interface EventFilters {
  when: When
  query: string
  types: Set<EventType>
  district: string
  priority: string
  closuresOnly: boolean
  sort: SortKey
}

export const DEFAULT_FILTERS: EventFilters = {
  when: 'now',
  query: '',
  types: new Set(),
  district: 'all',
  priority: 'all',
  closuresOnly: false,
  sort: 'priority',
}

const brisbaneWeekday = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long' })

/** Next day this event is active, for "Starts Mon 20 Oct" labels. */
export function nextActiveDate(e: TrafficEvent, now = Date.now()): Date | null {
  const d = e.properties.duration
  if (!d) return null
  if (hasEnded(e, now)) return null
  const start = d.start ? new Date(d.start) : null
  let t = Math.max(now, start?.getTime() ?? now)
  for (let i = 0; i < 8; i++, t += 86_400_000) {
    if (!d.active_days?.length || d.active_days.includes(brisbaneWeekday.format(t))) {
      return i === 0 && start && start.getTime() > now ? start : new Date(t)
    }
  }
  return start
}

function haystack(e: TrafficEvent): string {
  const p = e.properties
  const r = p.road_summary
  return [
    p.description,
    p.event_type,
    p.event_subtype,
    p.event_due_to,
    r?.road_name,
    r?.locality,
    r?.local_government_area,
    r?.district,
    r?.postcode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Everything except the type filter, so type chips can show counts for the current view. */
export function matchesBase(e: TrafficEvent, f: EventFilters, now = Date.now()): boolean {
  const p = e.properties
  if (isUpcoming(e, now) !== (f.when === 'upcoming')) return false
  if (f.district !== 'all' && !p.road_summary?.district?.split(' / ').includes(f.district)) return false
  if (f.priority !== 'all' && p.event_priority !== f.priority) return false
  if (f.closuresOnly && !isClosure(e)) return false
  const q = f.query.trim().toLowerCase()
  if (q && !q.split(/\s+/).every((t) => haystack(e).includes(t))) return false
  return true
}

export function applyFilters(
  events: TrafficEvent[],
  f: EventFilters,
  userLocation: LngLat | null,
): TrafficEvent[] {
  const list = events.filter((e) => matchesBase(e, f) && (f.types.size === 0 || f.types.has(e.properties.event_type)))

  const updated = (e: TrafficEvent) => new Date(e.properties.last_updated ?? 0).getTime()

  if (f.sort === 'nearest' && userLocation) {
    const dist = new Map(
      list.map((e) => {
        const a = eventAnchor(e)
        return [e.properties.id, a ? distanceKm(userLocation, a) : Infinity]
      }),
    )
    return list.sort((a, b) => dist.get(a.properties.id)! - dist.get(b.properties.id)!)
  }
  if (f.sort === 'recent') return list.sort((a, b) => updated(b) - updated(a))
  if (f.when === 'upcoming') {
    const next = (e: TrafficEvent) => nextActiveDate(e)?.getTime() ?? Infinity
    return list.sort((a, b) => next(a) - next(b))
  }
  return list.sort(
    (a, b) =>
      priorityRank(a.properties.event_priority) - priorityRank(b.properties.event_priority) ||
      Number(isClosure(b)) - Number(isClosure(a)) ||
      updated(b) - updated(a),
  )
}

export function districtsOf(events: TrafficEvent[]): string[] {
  const set = new Set<string>()
  for (const e of events) {
    for (const d of e.properties.road_summary?.district?.split(' / ') ?? []) if (d.trim()) set.add(d.trim())
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
