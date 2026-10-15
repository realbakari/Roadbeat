import type { Gauge } from '../api/bccGauges'
import type { SignalSite, SignalVolumes } from '../api/bccSignals'
import { FIRE_LEVELS, type FireLevel, type FireWarning } from '../api/bushfires'
import type { LiveVehicle, TripUpdate, TripUpdates, VehicleMode } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { hasEnded, isClosure, isUpcoming } from './filters'
import { changeWithin } from './gauges'
import { siteLoad } from './signals'

/** Events in effect now: published, not future roadworks or events, and not past their end date. */
export function currentEvents(events: TrafficEvent[], now: number) {
  return events.filter((e) => !isUpcoming(e, now) && !hasEnded(e, now))
}

export interface DistrictCount {
  district: string
  closures: number
  crashes: number
}

/** Closures and crashes in effect now, per QLDTraffic district, busiest first. Districts with neither are left out. */
export function closuresAndCrashesByDistrict(events: TrafficEvent[], now: number): DistrictCount[] {
  const by = new Map<string, DistrictCount>()
  for (const e of currentEvents(events, now)) {
    const closure = isClosure(e)
    const crash = e.properties.event_type === 'Crash'
    if (!closure && !crash) continue
    const district = e.properties.road_summary?.district?.trim() || 'Unknown district'
    const row = by.get(district) ?? { district, closures: 0, crashes: 0 }
    if (closure) row.closures++
    if (crash) row.crashes++
    by.set(district, row)
  }
  return [...by.values()].sort((a, b) => b.closures + b.crashes - (a.closures + a.crashes) || a.district.localeCompare(b.district))
}

/** On-time band for real-time running, in seconds: from 1 minute early to just under 5 minutes late. */
export const ON_TIME = { early: -60, late: 300 } as const

export interface Punctuality {
  mode: VehicleMode
  /** Trips with a vehicle reporting its position and a reported delay at their next stop. */
  tracked: number
  onTime: number
  late: number
  early: number
  /** Trips TransLink's feed marks as cancelled. */
  cancelled: number
}

/** The reported delay at the trip's next stop that hasn't been passed, in seconds. */
function nextDelay(trip: TripUpdate, now: number): number | null {
  for (const s of trip.stops) {
    if (s.skipped || s.time == null || s.time < now - 60_000) continue
    return s.delay
  }
  return null
}

/**
 * Running performance per mode from TransLink's real-time feed. Only trips with
 * a vehicle reporting its position count, because the feed also lists trips
 * that haven't started, whose delay is just the timetable. Every delay is as
 * TransLink reports it.
 */
export function punctuality(
  updates: TripUpdates,
  vehicles: LiveVehicle[],
  now: number,
  modeFor: (trip: TripUpdate) => VehicleMode,
): Punctuality[] {
  const running = new Set(vehicles.flatMap((v) => (v.tripId ? [`${v.region}-${v.tripId}`] : [])))
  const by = new Map<VehicleMode, Punctuality>()
  const row = (mode: VehicleMode) => {
    let r = by.get(mode)
    if (!r) by.set(mode, (r = { mode, tracked: 0, onTime: 0, late: 0, early: 0, cancelled: 0 }))
    return r
  }
  for (const trip of updates.trips) {
    if (trip.relationship === 'cancelled') {
      row(modeFor(trip)).cancelled++
      continue
    }
    if (!running.has(trip.key)) continue
    const delay = nextDelay(trip, now)
    if (delay == null) continue
    const r = row(modeFor(trip))
    r.tracked++
    if (delay < ON_TIME.early) r.early++
    else if (delay >= ON_TIME.late) r.late++
    else r.onTime++
  }
  const order: VehicleMode[] = ['train', 'bus', 'tram', 'ferry']
  return order.flatMap((m) => (by.has(m) ? [by.get(m)!] : []))
}

/** Current warnings and incidents per level, highest level first, including levels with none. */
export function firesByLevel(fires: FireWarning[]): { level: FireLevel; count: number }[] {
  return FIRE_LEVELS.map((level) => ({ level, count: fires.filter((f) => f.level === level).length }))
}

export interface RisingGauge {
  gauge: Gauge
  /** Metres risen between two real readings within the window. */
  delta: number
  latest: number
  /** Time of the latest reading (ms). */
  at: number
}

/** Stream gauges that rose the most over `windowMs`, between two reported readings. Falling or flat gauges are left out. */
export function fastestRising(gauges: Gauge[], windowMs: number, limit: number): RisingGauge[] {
  return gauges
    .filter((g) => g.kind === 'stream')
    .flatMap((gauge) => {
      const c = changeWithin(gauge, windowMs)
      return c && c.delta > 0 ? [{ gauge, delta: c.delta, latest: c.to.value, at: c.to.time }] : []
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit)
}

export interface BusySignal {
  site: SignalSite
  /** Highest degree of saturation across the site's lanes in its latest cycle, in %. */
  maxDs: number
  vehicles: number
  recorded: number
}

/** Signalised intersections with the highest measured degree of saturation in their latest cycle. */
export function busiestSignals(sites: SignalSite[], volumes: SignalVolumes, limit: number): BusySignal[] {
  return sites
    .flatMap((site) => {
      const approaches = volumes.get(site.tsc)
      return approaches?.length ? [{ site, ...siteLoad(approaches) }] : []
    })
    .sort((a, b) => b.maxDs - a.maxDs || b.vehicles - a.vehicles)
    .slice(0, limit)
}

/** Events in effect now, most recently updated first, for the ticker. */
export function latestEvents(events: TrafficEvent[], now: number, limit: number): TrafficEvent[] {
  const time = (e: TrafficEvent) => Date.parse(e.properties.last_updated ?? e.properties.published ?? '') || 0
  return currentEvents(events, now)
    .sort((a, b) => time(b) - time(a))
    .slice(0, limit)
}

export interface CorridorRow {
  name: string
  km: number | null
  /** Average AM (7–9 am) and PM (4–7 pm) peak travel times in the latest month, seconds. */
  am: number | null
  pm: number | null
  amKmh: number | null
  /** Change in AM peak travel time from the same month a year earlier, seconds. Null without both months. */
  amChange: number | null
}

/**
 * The latest month the council has published for every key corridor, each with
 * its change from the same month a year before. All values are the council's
 * measured averages.
 */
export function corridorReport(
  corridors: { siteId: number; name: string; km: number | null }[],
  months: { siteId: number; year: number; month: number; amSeconds: number | null; pmSeconds: number | null; amKmh: number | null }[],
): { year: number; month: number; rows: CorridorRow[] } | null {
  if (!months.length) return null
  const latest = months.reduce((a, b) => (b.year * 12 + b.month > a.year * 12 + a.month ? b : a))
  const at = (siteId: number, year: number) => months.find((m) => m.siteId === siteId && m.year === year && m.month === latest.month)
  const rows = corridors
    .flatMap((c) => {
      const now = at(c.siteId, latest.year)
      if (!now) return []
      const before = at(c.siteId, latest.year - 1)
      return [
        {
          name: c.name,
          km: c.km,
          am: now.amSeconds,
          pm: now.pmSeconds,
          amKmh: now.amKmh,
          amChange: now.amSeconds != null && before?.amSeconds != null ? now.amSeconds - before.amSeconds : null,
        },
      ]
    })
    .sort((a, b) => (b.am ?? 0) - (a.am ?? 0))
  return { year: latest.year, month: latest.month, rows }
}

const brisbaneHour = (t: number) => new Date(t + 10 * 3600_000).getUTCHours() + new Date(t + 10 * 3600_000).getUTCMinutes() / 60

/**
 * Council events still to start, or started in the last hour, soonest first.
 * All-day listings, such as exhibitions, are left out, so the list shows timed events.
 */
export function upcomingEvents<T extends { start: number; end: number | null }>(events: T[], now: number, limit: number): T[] {
  return events
    .filter((e) => {
      // The council lists exhibitions and other all-day items as starting at midnight.
      const allDay = brisbaneHour(e.start) === 0
      return !allDay && e.start >= now - 3600_000
    })
    .sort((a, b) => a.start - b.start)
    .slice(0, limit)
}

export interface FootTraffic {
  precinct: string
  /** Sum of the hours each sensor measured. Hours the council estimated, or published only as "< 25", aren't included. */
  movements: number
  measuredHours: number
  /** Sensor-hours in the day, measured or not. */
  hours: number
}

/** A day's measured pedestrian movements per precinct, busiest first. */
export function footTraffic(hours: { precinct: string | null; sensor: string; count: number | null; estimated: boolean }[]): FootTraffic[] {
  const by = new Map<string, FootTraffic>()
  for (const h of hours) {
    const precinct = h.precinct ?? h.sensor
    let row = by.get(precinct)
    if (!row) by.set(precinct, (row = { precinct, movements: 0, measuredHours: 0, hours: 0 }))
    row.hours++
    if (h.estimated || h.count == null) continue
    row.movements += h.count
    row.measuredHours++
  }
  return [...by.values()].sort((a, b) => b.movements - a.movements)
}
