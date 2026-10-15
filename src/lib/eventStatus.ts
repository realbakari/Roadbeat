import type { TrafficEvent } from '../api/types.js'

// Whether a QLDTraffic event is in effect. Free of browser-only code, so the app
// and the server functions in api/ share it.

export function isClosure(e: TrafficEvent): boolean {
  return e.properties.impact?.impact_type === 'Closures'
}

const brisbaneDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
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
