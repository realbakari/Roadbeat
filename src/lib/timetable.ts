import type { StopIndex } from '../api/stops'
import type { ScheduledStop, ScheduledTrip } from '../api/timetables'
import type { LiveVehicle, StopTime, TransitRegion, TripUpdate, TripUpdates } from '../api/translink'

/** What TransLink's real-time feed currently reports for one timetabled trip. */
export interface LiveTrip {
  update: TripUpdate
  vehicle: LiveVehicle | null
  cancelled: boolean
  /** Reported stop times by stop id (the feed drops stops already passed). */
  stops: Map<string, StopTime>
}

export interface LiveLookup {
  get(trip: ScheduledTrip): LiveTrip | null
}

/** A trip id repeats every day it runs; only match the instance within this of the timetable. */
const SAME_RUN = 6 * 3_600_000

export function liveLookup(updates: TripUpdates | null, vehicles: LiveVehicle[]): LiveLookup {
  const byNumber = new Map<string, TripUpdate[]>()
  for (const u of updates?.trips ?? []) {
    // ADDED trips aren't in the published timetable, though their ids can share a timetabled trip's number.
    if (u.relationship === 'added') continue
    const k = `${u.region}-${Number(u.tripId.split('-')[0])}`
    byNumber.set(k, [...(byNumber.get(k) ?? []), u])
  }
  const byTrip = new Map<string, LiveVehicle>()
  for (const v of vehicles) if (v.tripId) byTrip.set(`${v.region}-${v.tripId}`, v)

  return {
    get(trip) {
      const list = byNumber.get(`${trip.region}-${trip.number}`)
      if (!list) return null
      const first = trip.stops[0].time
      for (const update of list) {
        const t = update.stops.find((s) => s.time != null)?.time
        if (t != null && Math.abs(t - first) > SAME_RUN) continue
        return {
          update,
          vehicle: byTrip.get(update.key) ?? null,
          cancelled: update.relationship === 'cancelled',
          stops: new Map(update.stops.map((s) => [s.stopId, s])),
        }
      }
      return null
    },
  }
}

export interface GridRow {
  /** Station id for platforms, else the stop id. */
  id: string
  region: TransitRegion
  name: string | null
}

export interface GridDirection {
  direction: 0 | 1
  /** Official headsigns in this direction, most frequent first. */
  headsigns: string[]
  rows: GridRow[]
  /** Row the trips are ordered by: the stop most of them call at. */
  reference: number
  /** Trips in departure order at the reference stop; `cells[t][r]` is trip t's stop at row r, if it calls there. */
  trips: ScheduledTrip[]
  cells: (ScheduledStop | null)[][]
}

/**
 * A line's published timetable as one stop × trip grid per GTFS direction, like
 * TransLink's own timetable pages. Platforms are shown as their station.
 */
export function timetableGrid(trips: ScheduledTrip[], stops: StopIndex | null): GridDirection[] {
  const stationOf = (region: TransitRegion, stopId: string): GridRow => {
    const s = stops?.get(region, stopId)
    const st = s ? stops!.station(s) : null
    return { id: st?.id ?? stopId, region, name: st?.name ?? null }
  }

  const out: GridDirection[] = []
  for (const direction of [0, 1] as const) {
    const list = trips.filter((t) => t.direction === direction)
    if (!list.length) continue
    // Merge every trip's stop order into one sequence, longest trips first.
    const order: string[] = []
    const rows = new Map<string, GridRow>()
    const heads = new Map<string, number>()
    for (const t of [...list].sort((a, b) => b.stops.length - a.stops.length)) {
      heads.set(t.headsign, (heads.get(t.headsign) ?? 0) + 1)
      let prev: string | null = null
      for (const s of t.stops) {
        const row = stationOf(t.region, s.stopId)
        const key = `${row.region}:${row.id}`
        if (!rows.has(key)) {
          rows.set(key, row)
          order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, key)
        }
        prev = key
      }
    }
    const at = new Map(order.map((k, i) => [k, i]))
    const cellsOf = (t: ScheduledTrip) => {
      const cells: (ScheduledStop | null)[] = order.map(() => null)
      for (const s of t.stops) {
        const r = stationOf(t.region, s.stopId)
        cells[at.get(`${r.region}:${r.id}`)!] ??= s
      }
      return cells
    }
    // Like TransLink, order services by their time at the stop most of them call at,
    // and among stops every service calls at, by Roma Street or Central, as TransLink's timetables do.
    const grid = list.map((t) => ({ t, c: cellsOf(t) }))
    const calls = order.map((_, r) => grid.filter((g) => g.c[r]).length)
    const most = order.map((_, r) => r).filter((r) => calls[r] === Math.max(...calls))
    const named = (re: RegExp) => most.find((r) => re.test(rows.get(order[r])!.name ?? ''))
    const reference = named(/^Roma Street\b/i) ?? named(/^Central\b/i) ?? most[0]
    const sortTime = (g: (typeof grid)[number]) => g.c[reference]?.time ?? g.t.stops[0].time
    grid.sort((a, b) => sortTime(a) - sortTime(b) || a.t.number - b.t.number)
    out.push({
      direction,
      headsigns: [...heads.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h),
      rows: order.map((k) => rows.get(k)!),
      reference,
      trips: grid.map((g) => g.t),
      cells: grid.map((g) => g.c),
    })
  }
  return out
}

export interface ScheduledDeparture {
  key: string
  trip: ScheduledTrip
  stop: ScheduledStop
}

/** Every published departure from any of `stopIds` (not a trip's final arrival), in time order. */
export function scheduledDepartures(trips: ScheduledTrip[], stopIds: Set<string>): ScheduledDeparture[] {
  const out: ScheduledDeparture[] = []
  for (const trip of trips)
    trip.stops.forEach((stop, i) => {
      if (stopIds.has(stop.stopId) && stop.kind !== 'arrival' && i < trip.stops.length - 1)
        out.push({ key: `${trip.key}:${i}`, trip, stop })
    })
  return out.sort((a, b) => a.stop.time - b.stop.time || a.trip.route.localeCompare(b.trip.route))
}

/**
 * Services that end at (or only set down at) any of `stopIds`, in arrival
 * order: the TransLink app's "Arrivals" tab. Times are the published arrivals.
 */
export function scheduledArrivals(trips: ScheduledTrip[], stopIds: Set<string>): ScheduledDeparture[] {
  const out: ScheduledDeparture[] = []
  for (const trip of trips)
    trip.stops.forEach((stop, i) => {
      if (i > 0 && stopIds.has(stop.stopId) && (stop.kind === 'arrival' || i === trip.stops.length - 1))
        out.push({ key: `${trip.key}:a${i}`, trip, stop })
    })
  return out.sort((a, b) => a.stop.arrival - b.stop.arrival || a.trip.route.localeCompare(b.trip.route))
}
