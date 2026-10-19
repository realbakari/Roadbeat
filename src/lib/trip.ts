import type { ScheduledStop, ScheduledTrip } from '../api/timetables'
import type { LiveVehicle, StopTime, TransitRegion, TripUpdate, TripUpdates } from '../api/transitTypes'
import { alignStops } from './stopAlign'
import type { ScheduledDeparture } from './timetable'

/**
 * App hash for one trip's page. `tripId` is the GTFS trip id, or just its
 * leading number (all the published timetable keeps). `route` says which
 * timetable file holds it; `date` is its service day when known.
 */
export function tripHref(region: TransitRegion, tripId: string | number, route: string, date?: string | null) {
  return `transit/trip/${region}/${encodeURIComponent(String(tripId))}/${encodeURIComponent(route)}${date ? `/${date}` : ''}`
}

/** App hash for a published trip, on its service day. */
export function timetableTripHref(trip: ScheduledTrip) {
  // ScheduledTrip keys end with the service day ("SEQ-1234-2026-10-15").
  return tripHref(trip.region, trip.number, trip.route, trip.key.slice(-10))
}

/** The leading number of a GTFS trip id, shared by the timetable and real-time feeds. */
export function tripNumber(tripId: string) {
  return Number(tripId.split('-')[0])
}

/** A trip id repeats every day it runs; only match the instance within this of the timetable. */
const SAME_RUN = 6 * 3_600_000

const firstReported = (u: TripUpdate) => u.stops.find((s) => s.time != null)?.time ?? null

/**
 * Which run of trip `number` a page shows: the service day `date` when given,
 * else the run the real-time feed reports, else the run nearest `now`.
 */
export function pickRun(trips: ScheduledTrip[], number: number, date: string | null, update: TripUpdate | null, now: number) {
  // An ADDED trip isn't timetabled; its id can still share a timetabled trip's number.
  if (update?.relationship === 'added') return null
  const runs = trips.filter((t) => t.number === number)
  if (date) return runs.find((t) => t.key.endsWith(`-${date}`)) ?? null
  const near = (t: number) => (a: ScheduledTrip, b: ScheduledTrip) => Math.abs(a.stops[0].time - t) - Math.abs(b.stops[0].time - t)
  const reported = update && firstReported(update)
  if (reported != null) {
    const run = [...runs].sort(near(reported))[0]
    return run && Math.abs(run.stops[0].time - reported) <= SAME_RUN ? run : null
  }
  const running = runs.find((t) => t.stops[0].time <= now && now <= t.stops[t.stops.length - 1].time)
  return running ?? [...runs].sort(near(now))[0] ?? null
}

/**
 * The feed's TripUpdate and reporting vehicle for trip `number`, if any. With
 * `firstTime` (the timetabled run's start), only the run within six hours of
 * it, and never an ADDED trip, whose id can share a timetabled trip's number.
 */
export function liveTrip(
  updates: TripUpdates | null,
  vehicles: LiveVehicle[],
  region: TransitRegion,
  number: number,
  firstTime: number | null,
) {
  const update =
    updates?.trips.find(
      (u) =>
        u.region === region &&
        tripNumber(u.tripId) === number &&
        (firstTime == null || u.relationship !== 'added') &&
        (firstTime == null || Math.abs((firstReported(u) ?? firstTime) - firstTime) <= SAME_RUN),
    ) ?? null
  const added = new Set(firstTime == null ? [] : (updates?.trips ?? []).filter((u) => u.relationship === 'added').map((u) => u.tripId))
  const vehicle =
    vehicles.find(
      (v) =>
        v.region === region &&
        v.tripId != null &&
        (update ? v.tripId === update.tripId : tripNumber(v.tripId) === number && !added.has(v.tripId)),
    ) ?? null
  return { update, vehicle }
}

export interface TripStopRow {
  /** The stop the feed reports, or else the published one. */
  stopId: string
  /** The published stop, or null for a stop only the real-time feed lists. */
  scheduled: ScheduledStop | null
  /** What Translink's real-time feed reports for this stop, or null where it says nothing. */
  rt: StopTime | null
  /** The feed lists this stop but the trip's published timetable doesn't call there. */
  added: boolean
  /** The feed reports another platform of the published stop's station: the published stop id. */
  movedFrom: string | null
  /** The vehicle reports a later stop of this trip as its current one. */
  passed: boolean
  /** The vehicle reports this stop as its current one. */
  here: boolean
}

/**
 * A trip's stops in order with what the real-time feed reports for each.
 * Stops come from the published timetable, each paired with the feed's report
 * for that visit (see `alignStops`), with any stop the feed lists that
 * the timetable doesn't placed after the stop the feed lists before it, and
 * the feed's platform where it differs. A stop the feed leaves out is not
 * skipped (it often omits a trip's last stops); only the feed's SKIPPED says
 * so. A stop is marked passed only when the vehicle reports a later stop as
 * current; nothing is inferred from the clock. `sameStop` treats two
 * platforms of one station as the same stop.
 */
export function tripStops(
  trip: ScheduledTrip | null,
  update: TripUpdate | null,
  vehicle: LiveVehicle | null,
  sameStop: (a: string, b: string) => boolean = (a, b) => a === b,
): TripStopRow[] {
  const reported = update?.stops ?? []
  const row = (s: ScheduledStop | null, rt: StopTime | null): TripStopRow => ({
    stopId: rt?.stopId ?? s!.stopId,
    scheduled: s,
    rt,
    added: !!trip && !s,
    movedFrom: s && rt && rt.stopId !== s.stopId ? s.stopId : null,
    passed: false,
    here: false,
  })
  let rows: TripStopRow[]
  if (!trip) rows = reported.map((r) => row(null, r))
  else {
    const matched = alignStops(trip.stops, reported, sameStop)
    const used = new Set(matched.filter((r) => r != null))
    rows = trip.stops.map((s, i) => row(s, matched[i]))
    // Feed stops the timetable lacks go after the row of the feed stop before them.
    let after = -1
    for (const r of reported) {
      if (used.has(r)) {
        after = rows.findIndex((x) => x.rt === r)
        continue
      }
      rows.splice(after + 1, 0, row(null, r))
      after++
    }
  }
  // A loop passes its current stop twice: the visit is the one the feed still lists, not one it has dropped as passed.
  const from = Math.max(0, rows.findIndex((r) => r.rt))
  const find = (start: number) => rows.findIndex((r, i) => i >= start && sameStop(r.stopId, vehicle!.stopId!))
  const at = vehicle?.stopId ? (find(from) >= 0 ? find(from) : find(0)) : -1
  if (at >= 0) {
    rows[at].here = true
    for (let i = 0; i < at; i++) rows[i].passed = true
  }
  return rows
}

/**
 * What this session has seen of Translink's TripUpdates feed. Translink often
 * drops a trip's last stops (some by two hours), so a trip missing from one
 * snapshot may simply have passed its last listed stop. Only a trip the feed
 * never listed, while it was polled without a break since before the trip's
 * timetabled start, is known to be absent from it.
 */
export interface FeedWatch {
  /** Per region, the feed time when the current unbroken run of polls began. */
  since: Partial<Record<TransitRegion, number>>
  /** Per region, the latest feed time seen. */
  last: Partial<Record<TransitRegion, number>>
  /** "SEQ-1234" → the first reported time of each run of that trip the feed has listed. */
  seen: Map<string, number[]>
}

/** Polls further apart than this break the watch (the poller runs every 30 s while the page is visible). */
const MAX_GAP = 3 * 60_000
const KEEP = 30 * 3_600_000

/** Adds one region's TripUpdates snapshot to the watch. */
export function watchFeed(prev: FeedWatch | null, region: TransitRegion, part: TripUpdates): FeedWatch {
  const at = part.at[region]
  if (at == null) return prev ?? { since: {}, last: {}, seen: new Map() }
  const last = prev?.last[region]
  const unbroken = last != null && at - last <= MAX_GAP
  const seen = new Map<string, number[]>()
  for (const [k, runs] of prev?.seen ?? []) {
    const kept = runs.filter((t) => t > at - KEEP)
    if (kept.length) seen.set(k, kept)
  }
  for (const u of part.trips) {
    if (u.region !== region || u.relationship === 'added') continue
    const k = `${region}-${tripNumber(u.tripId)}`
    const t = firstReported(u) ?? at
    const runs = seen.get(k) ?? []
    if (!runs.some((r) => Math.abs(r - t) <= SAME_RUN)) seen.set(k, [...runs, t])
  }
  return {
    since: {
      ...prev?.since,
      [region]: unbroken ? (prev!.since[region] ?? at) : at,
    },
    last: { ...prev?.last, [region]: Math.max(at, last ?? 0) },
    seen,
  }
}

/** How long after a missed departure it stays flagged. */
const OVERDUE_WINDOW = 30 * 60_000

/**
 * Minutes since a published departure was due, when Translink's real-time
 * feeds have shown nothing for its trip: the time has passed, the TripUpdates
 * feed was watched without a break from before the trip's timetabled start
 * until after the due time and never listed it, and no vehicle reports it now.
 * Otherwise null. This states what the feeds show; it doesn't say the service
 * is cancelled, which only Translink's feed can.
 */
export function overdueMinutes(d: ScheduledDeparture, watch: FeedWatch | null, reporting: Set<string>, now: number): number | null {
  const due = d.stop.time
  if (due >= now - 60_000 || due < now - OVERDUE_WINDOW) return null
  const since = watch?.since[d.trip.region]
  const last = watch?.last[d.trip.region]
  if (since == null || last == null || since > d.trip.stops[0].time || last < due || now - last > MAX_GAP) return null
  const k = `${d.trip.region}-${d.trip.number}`
  if (reporting.has(k)) return null
  if (watch!.seen.get(k)?.some((t) => Math.abs(t - d.trip.stops[0].time) <= SAME_RUN)) return null
  return Math.floor((now - due) / 60_000)
}
/** "SEQ-1234" for each trip a vehicle reports it is running, to test with `overdueMinutes`. */
export function reportingTrips(vehicles: LiveVehicle[]) {
  return new Set(vehicles.flatMap((v) => (v.tripId ? [`${v.region}-${tripNumber(v.tripId)}`] : [])))
}
