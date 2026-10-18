import type { TrafficEvent } from '../api/types.js'
import { brisbaneDayKey as brisbaneDay } from './aest.js'

// Whether a QLDTraffic event is in effect. Free of browser-only code, so the app
// and the server functions in api/ share it.

/**
 * Closures QLDTraffic files that close only part of the road. Its feed puts
 * them under the impact type "Closures", but its map gives them a lane
 * closure pin, not a road closed one, and so does Roadbeat.
 */
const LANE_CLOSURES = new Set(['One lane closed', 'Partial lane closures'])

/** Whether the road itself is closed: to all traffic, to through traffic, or a closure QLDTraffic doesn't narrow to lanes. */
export function isClosure(e: TrafficEvent): boolean {
  const i = e.properties.impact
  return i?.impact_type === 'Closures' && !LANE_CLOSURES.has(i.impact_subtype ?? '')
}

/** Whether part of the road is closed and the rest stays open, such as one lane closed northbound. */
export function isLaneClosure(e: TrafficEvent): boolean {
  const i = e.properties.impact
  return i?.impact_type === 'Closures' && LANE_CLOSURES.has(i.impact_subtype ?? '')
}

const brisbaneWeekday = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long' })

/**
 * Mirrors the QLDTraffic website: roadworks and special events that aren't
 * active today (outside their date range, or today isn't one of their active
 * days) are "future" alerts. Unplanned events are always current.
 */
export function isUpcoming(e: TrafficEvent, now = Date.now()): boolean {
  const p = e.properties
  if (p.event_type !== 'Roadworks' && p.event_type !== 'Special event') return false
  const d = p.duration
  if (!d) return false
  const today = brisbaneDay.format(now)
  const day = (iso: string) => brisbaneDay.format(new Date(iso))
  if (d.start && day(d.start) > today) return true
  if (d.end && day(d.end) < today) return true
  if (d.active_days?.length && !d.active_days.includes(brisbaneWeekday.format(now))) return true
  return false
}

/** Still published but past its scheduled end (the official site lists these as future). */
export function hasEnded(e: TrafficEvent, now = Date.now()): boolean {
  const end = e.properties.duration?.end
  return !!end && brisbaneDay.format(new Date(end)) < brisbaneDay.format(now)
}

/**
 * In effect now, as the official site counts it: neither upcoming nor past its
 * end. The app's list, header, dashboard and API all count with this.
 */
export function isCurrent(e: TrafficEvent, now = Date.now()): boolean {
  return !isUpcoming(e, now) && !hasEnded(e, now)
}

/** "Starts" for a start time still to come, else "Started": upcoming roadworks haven't begun. */
export function startLabel(start: string | null | undefined, now = Date.now()): 'Starts' | 'Started' {
  const t = start ? Date.parse(start) : NaN
  return Number.isFinite(t) && t > now ? 'Starts' : 'Started'
}
