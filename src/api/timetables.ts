import type { TransitRegion } from './translink'

// TransLink's published timetables (GTFS stop_times), one file per route under
// /timetables (see scripts/build-timetables.mjs). Every time here is exactly as
// TransLink publishes it, to the minute; nothing is interpolated.

type Pattern = [direction: 0 | 1, stops: number[], offsets: number[], flags: string, dwell?: number[]]
type TripRow = [pattern: number, first: number, service: number, headsign: number, number: number]

/** A route's published timetable as built by scripts/build-timetables.mjs. */
export interface RouteFile {
  region: TransitRegion
  route: string
  start: string
  days: number
  stops: string[]
  heads: string[]
  services: string[]
  patterns: Pattern[]
  trips: TripRow[]
}

interface RegionIndex {
  start: string
  days: number
  routes: string[]
  /** For each route, the station (or stop) most of its trips end at. */
  finals: string[]
  /** Stop or station id → "."-joined base-36 indexes into `routes`. */
  stops: Record<string, string>
}

export interface TimetableIndex {
  source: string
  generated: string
  regions: Partial<Record<TransitRegion, RegionIndex>>
}

/** How a stop is served: normally, drop-off only (the trip's arrival), or pick-up only. */
export type StopKind = 'normal' | 'arrival' | 'pickup'
const KIND: Record<string, StopKind> = { '0': 'normal', d: 'arrival', p: 'pickup' }

export interface ScheduledStop {
  stopId: string
  /** Published departure time (ms). */
  time: number
  /** Published arrival time (ms); earlier than `time` where the timetable has the vehicle waiting. */
  arrival: number
  kind: StopKind
}

export interface ScheduledTrip {
  key: string
  region: TransitRegion
  route: string
  /** Leading number of the GTFS trip id, which real-time TripUpdates carry too. */
  number: number
  /** The service day it runs on (a Brisbane date); its times can run past that day's midnight. */
  date: string
  headsign: string
  direction: 0 | 1
  stops: ScheduledStop[]
}

const DAY = 86_400_000
const BASE = `${import.meta.env.BASE_URL}timetables/`

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(BASE + path)
  // A static host may answer a missing file with index.html.
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
  return (await res.json()) as T
}

let index: Promise<TimetableIndex | null> | null = null
export function loadTimetableIndex() {
  index ??= getJson<TimetableIndex>('index.json').catch(() => ((index = null), null))
  return index
}

const routes = new Map<string, Promise<RouteFile | null>>()
function loadRoute(region: TransitRegion, code: string) {
  const k = `${region}/${code}`
  let p = routes.get(k)
  if (!p) {
    p = getJson<RouteFile>(`${region}/${encodeURIComponent(code)}.json`).catch(() => (routes.delete(k), null))
    routes.set(k, p)
  }
  return p
}

/** Brisbane calendar date ("2026-10-15") of an instant. Queensland has no daylight saving. */
export function brisbaneDate(t: number) {
  return new Date(t + 10 * 3_600_000).toISOString().slice(0, 10)
}

/** Midnight in Brisbane at the start of `date`, the reference for that service day's times. */
export function dayStart(date: string) {
  return Date.parse(`${date}T00:00:00+10:00`)
}

/** Dates the published timetable covers, from `from` (a Brisbane date) to its last day. */
export function timetableDates(idx: TimetableIndex, region: TransitRegion, from: string): string[] {
  const r = idx.regions[region]
  if (!r) return []
  const first = Date.parse(r.start)
  const out: string[] = []
  for (let i = 0; i < r.days; i++) {
    const d = new Date(first + i * DAY).toISOString().slice(0, 10)
    if (d >= from) out.push(d)
  }
  return out
}

/** Route codes in the timetable that call at any of `stopIds`. */
export function routesAtStops(idx: TimetableIndex, region: TransitRegion, stopIds: Iterable<string>): string[] {
  const r = idx.regions[region]
  if (!r) return []
  const out = new Set<string>()
  for (const id of stopIds) for (const i of r.stops[id]?.split('.') ?? []) out.add(r.routes[parseInt(i, 36)])
  return [...out]
}

/** The Brisbane date before `date`. */
export function previousDate(date: string) {
  return new Date(Date.parse(date) - DAY).toISOString().slice(0, 10)
}

/**
 * Trips that can depart on calendar day `date`: that service day's plus the
 * previous one's, whose published times past 24:00 fall after this midnight.
 */
export async function loadTripsAround(region: TransitRegion, codes: string[], date: string): Promise<ScheduledTrip[]> {
  const [before, on] = await Promise.all([loadTripsOn(region, codes, previousDate(date)), loadTripsOn(region, codes, date)])
  const midnight = dayStart(date)
  return [...before.filter((t) => t.stops[t.stops.length - 1].time >= midnight), ...on]
}

/** Every published trip on these routes that runs on service day `date`. */
export async function loadTripsOn(region: TransitRegion, codes: string[], date: string): Promise<ScheduledTrip[]> {
  const files = await Promise.all(codes.map((c) => loadRoute(region, c)))
  return files.flatMap((f) => (f ? tripsOnDay(f, date) : []))
}

/** Decodes one route file's trips that run on service day `date` (a Brisbane date). */
export function tripsOnDay(f: RouteFile, date: string): ScheduledTrip[] {
  const day = (Date.parse(date) - Date.parse(f.start)) / DAY
  if (day < 0 || day >= f.days) return []
  const midnight = dayStart(date)
  const runs = f.services.map((hex) => (parseInt(hex[day >> 2], 16) >> (day & 3)) & 1)
  const out: ScheduledTrip[] = []
  for (const [p, first, service, head, number] of f.trips) {
    if (!runs[service]) continue
    const [direction, stops, offsets, flags, dwell] = f.patterns[p]
    out.push({
      key: `${f.region}-${number}-${date}`,
      region: f.region,
      route: f.route,
      date,
      number,
      headsign: f.heads[head],
      direction,
      stops: stops.map((s, i) => ({
        stopId: f.stops[s],
        time: midnight + (first + offsets[i]) * 60_000,
        arrival: midnight + (first + offsets[i] - (dwell?.[i] ?? 0)) * 60_000,
        kind: KIND[flags[i]] ?? 'normal',
      })),
    })
  }
  return out
}
