import type { FireWarning } from '../api/bushfireFeed.js'
import type { TransitRegion } from '../api/transitTypes.js'
import type { TrafficEvent } from '../api/types.js'
import type { Departure } from './departures.js'
import { hasEnded, isClosure, isUpcoming } from './eventStatus.js'

// "My commute": the roads, stop and route a rider travels at a set time. Pure and
// free of browser-only code, so the in-app briefing card and the push alert
// checker in api/ make the same decisions from the same official data.

export interface Commute {
  /** Road names, suburbs or postcodes, matched like the alert settings' roads. */
  roads: string[]
  region: TransitRegion
  /** Station or stop id, or null for a roads-only commute. */
  stopId: string | null
  /** Route or line to watch at the stop ("T1", "402", "F1"), or null for any. */
  route: string | null
  /** Usual departure, in minutes after midnight Brisbane time. */
  minutes: number
  /** Days it runs: 0 = Sunday … 6 = Saturday. */
  days: number[]
}

export const DEFAULT_COMMUTE: Commute = { roads: [], region: 'SEQ', stopId: null, route: null, minutes: 7 * 60 + 30, days: [1, 2, 3, 4, 5] }

/** The briefing shows, and push alerts fire, from this long before the usual departure… */
export const WINDOW_BEFORE = 90 * 60_000
/** …until this long after it. */
export const WINDOW_AFTER = 30 * 60_000
/** A tracked service this late counts as delayed for an alert. */
export const ALERT_DELAY = 5 * 60
/** Bushfire warnings within this distance of the stop are part of the briefing. */
export const FIRE_KM = 25

const BRISBANE = 10 * 3600_000
const DAY = 24 * 3600_000

/** When the commute next departs at or after `now - WINDOW_AFTER`, and whether `now` is inside its window. */
export function commuteWindow(c: Commute, now: number): { departs: number; active: boolean } | null {
  if (!c.days.length) return null
  const local = now + BRISBANE
  const midnight = local - (local % DAY) - BRISBANE
  for (let d = 0; d < 8; d++) {
    const day = midnight + d * DAY
    const weekday = new Date(day + BRISBANE).getUTCDay()
    if (!c.days.includes(weekday)) continue
    const departs = day + c.minutes * 60_000
    if (departs + WINDOW_AFTER < now) continue
    return { departs, active: now >= departs - WINDOW_BEFORE }
  }
  return null
}

/** Whether a road event mentions any of the commute's roads, suburbs or postcodes. */
export function onRoads(e: TrafficEvent, roads: string[]) {
  if (!roads.length) return false
  const r = e.properties.road_summary
  const hay = [r?.road_name, r?.locality, r?.postcode, r?.local_government_area, e.properties.description].filter(Boolean).join(' ').toLowerCase()
  return roads.some((q) => q.trim() && hay.includes(q.trim().toLowerCase()))
}

const PRIORITY: Record<string, number> = { 'Red Alert': 0, High: 1, Medium: 2, Low: 3 }

/** Events in effect on the commute's roads: closures first, then by priority. */
export function roadEventsFor(c: Commute, events: TrafficEvent[], now: number): TrafficEvent[] {
  return events
    .filter((e) => onRoads(e, c.roads) && !isUpcoming(e, now) && !hasEnded(e, now))
    .sort((a, b) => Number(isClosure(b)) - Number(isClosure(a)) || (PRIORITY[a.properties.event_priority] ?? 9) - (PRIORITY[b.properties.event_priority] ?? 9))
}

/** Names a route can be called by: its code, short name and T-line ("T1", "T1 Caboolture"). */
export type RouteNames = (code: string, region: TransitRegion) => { short?: string; line?: string } | null

/** Whether a departure is on the commute's route (any route when none is set). */
export function onRoute(c: Commute, d: Departure, names: RouteNames) {
  if (!c.route) return true
  const q = c.route.trim().toLowerCase()
  const info = names(d.trip.route, d.trip.region)
  return [d.trip.route, info?.short, info?.line, info?.line?.split(' ')[0]].some((x) => x?.toLowerCase() === q)
}

function distanceKm(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Bushfire warnings (not plain incidents) within FIRE_KM of the stop, highest level first. */
export function firesNear(at: [number, number] | null, fires: FireWarning[]): FireWarning[] {
  if (!at) return []
  return fires.filter((f) => f.level !== 'Information' && distanceKm(at, f.position) <= FIRE_KM)
}

export interface CommuteAlert {
  /** Stable id: an alert with the same key is sent once. */
  key: string
  title: string
  body: string
  /** App hash to open. */
  href: string
}

/**
 * Push alerts worth sending for a commute right now: closures and crashes on its
 * roads, its route's services cancelled or tracked running ALERT_DELAY late, and
 * Emergency Warning or Watch and Act bushfires near its stop. Every alert comes
 * from a reported value; nothing is predicted.
 */
export function commuteAlerts(
  c: Commute,
  data: { events: TrafficEvent[]; departures: Departure[]; fires: FireWarning[]; stopName: string | null; stopAt: [number, number] | null },
  names: RouteNames,
  now: number,
): CommuteAlert[] {
  const out: CommuteAlert[] = []
  for (const e of roadEventsFor(c, data.events, now)) {
    const p = e.properties
    const closure = isClosure(e)
    if (!closure && p.event_type !== 'Crash') continue
    const where = [p.road_summary?.road_name, p.road_summary?.locality].filter(Boolean).join(', ')
    out.push({
      key: `event:${p.id}:${closure ? 'closed' : 'crash'}`,
      title: closure ? `Road closed: ${where}` : `Crash: ${where}`,
      body: p.description?.trim() || p.advice?.trim() || `${p.event_type} reported by QLDTraffic.`,
      href: `event/${p.id}`,
    })
  }
  for (const d of data.departures) {
    if (!onRoute(c, d, names) || d.time > now + WINDOW_BEFORE) continue
    const info = names(d.trip.route, d.trip.region)
    const label = info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route
    const at = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' }).format(d.scheduled ?? d.time)
    const what = `${at} ${label}${d.headsign ? ` to ${d.headsign}` : ''}${data.stopName ? ` from ${data.stopName}` : ''}`
    if (d.trip.relationship === 'cancelled') {
      out.push({ key: `trip:${d.key}:cancelled`, title: `Cancelled: ${what}`, body: 'TransLink reports this service is cancelled.', href: `transit/stop/${c.region}/${encodeURIComponent(c.stopId ?? '')}` })
    } else if (d.vehicle && d.delay != null && d.delay >= ALERT_DELAY) {
      const late = Math.round(d.delay / 60)
      out.push({
        key: `trip:${d.key}:late${Math.floor(late / 5) * 5}`,
        title: `${late} min late: ${what}`,
        body: 'As reported by TransLink real-time from the vehicle on this trip.',
        href: `transit/stop/${c.region}/${encodeURIComponent(c.stopId ?? '')}`,
      })
    }
  }
  for (const f of firesNear(data.stopAt, data.fires)) {
    if (f.level !== 'Emergency Warning' && f.level !== 'Watch and Act') continue
    out.push({ key: `fire:${f.id}:${f.level}`, title: `${f.level}: ${f.title}`, body: f.callToAction ?? 'Queensland Fire Department warning near your stop.', href: `fire/${encodeURIComponent(f.id)}` })
  }
  return out
}
