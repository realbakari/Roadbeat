import type { StopIndex, TripIndex } from '../api/stops.js'
import type { LiveVehicle, StopTime, TransitRegion, TripUpdate, TripUpdates } from '../api/transitTypes.js'

/**
 * A departure exactly as Translink's real-time feed lists it. `time` is the
 * reported time; `scheduled` is that time minus the reported delay (the
 * timetabled time), so nothing here is estimated.
 */
export interface Departure {
  key: string
  trip: TripUpdate
  stopId: string
  time: number
  scheduled: number | null
  /** Seconds late (+) or early (−) as reported, or null. */
  delay: number | null
  /** A vehicle is reporting its position on this trip, so the time is a live prediction. */
  vehicle: LiveVehicle | null
  headsign: string | null
  direction: 0 | 1 | null
}

export interface DepartureContext {
  updates: TripUpdates
  vehicles: LiveVehicle[]
  trips: TripIndex | null
  now: number
}

/** App hash for a stop page. */
export function stopHref(region: TransitRegion, id: string) {
  return `transit/stop/${region}/${encodeURIComponent(id)}`
}

/** How far back a departure stays listed, so a train at the platform doesn't vanish early. */
const GRACE = 60_000

function vehicleIndex(vehicles: LiveVehicle[]) {
  const m = new Map<string, LiveVehicle>()
  for (const v of vehicles) if (v.tripId) m.set(`${v.region}-${v.tripId}`, v)
  return m
}

function toDeparture(trip: TripUpdate, s: StopTime, ctx: DepartureContext, vehicles: Map<string, LiveVehicle>): Departure | null {
  if (s.skipped || s.arrivalOnly || s.time == null || s.time < ctx.now - GRACE) return null
  const info = ctx.trips?.get(trip.region, trip.tripId) ?? null
  return {
    key: `${trip.key}:${s.sequence ?? s.stopId}`,
    trip,
    stopId: s.stopId,
    time: s.time,
    scheduled: s.delay != null ? s.time - s.delay * 1000 : null,
    delay: s.delay,
    vehicle: vehicles.get(trip.key) ?? null,
    headsign: info?.headsign ?? null,
    direction: info?.direction ?? null,
  }
}

/** Upcoming departures from any of `stopIds`, soonest first. */
export function departuresAt(ctx: DepartureContext, region: TransitRegion, stopIds: Set<string>, limit = 30): Departure[] {
  const vehicles = vehicleIndex(ctx.vehicles)
  const out: Departure[] = []
  for (const trip of ctx.updates.trips) {
    if (trip.region !== region) continue
    for (const s of trip.stops) {
      if (!stopIds.has(s.stopId)) continue
      const d = toDeparture(trip, s, ctx, vehicles)
      if (d) out.push(d)
    }
  }
  return out.sort((a, b) => a.time - b.time).slice(0, limit)
}

export interface DirectionStop {
  /** Station id for platforms, else the stop id. */
  id: string
  region: TransitRegion
  name: string | null
  departures: Departure[]
}

export interface LineDirection {
  direction: 0 | 1 | null
  /** Official headsigns in this direction, most frequent first. */
  headsigns: string[]
  trips: number
  stops: DirectionStop[]
}

/**
 * A line's upcoming services per GTFS direction, laid out by stop in the
 * order the feed lists them. Only trips present in the real-time feed appear.
 */
export function lineDirections(
  ctx: DepartureContext,
  stops: StopIndex | null,
  match: (code: string, region: TransitRegion) => boolean,
  perStop = 3,
): LineDirection[] {
  const vehicles = vehicleIndex(ctx.vehicles)
  const groups = new Map<string, { direction: 0 | 1 | null; heads: Map<string, number>; trips: TripUpdate[] }>()
  for (const trip of ctx.updates.trips) {
    if (trip.relationship === 'cancelled' || !match(trip.route, trip.region)) continue
    const info = ctx.trips?.get(trip.region, trip.tripId) ?? null
    const k = String(info?.direction ?? 'other')
    let g = groups.get(k)
    if (!g) groups.set(k, (g = { direction: info?.direction ?? null, heads: new Map(), trips: [] }))
    if (info) g.heads.set(info.headsign, (g.heads.get(info.headsign) ?? 0) + 1)
    g.trips.push(trip)
  }

  const stationOf = (region: TransitRegion, stopId: string) => {
    const s = stops?.get(region, stopId)
    const st = s ? stops!.station(s) : null
    return { id: st?.id ?? stopId, name: st?.name ?? null }
  }

  const out: LineDirection[] = []
  for (const g of groups.values()) {
    // Merge each trip's reported stop order into one sequence, longest trips first.
    const order: string[] = []
    const rows = new Map<string, DirectionStop>()
    for (const trip of [...g.trips].sort((a, b) => b.stops.length - a.stops.length)) {
      let prev: string | null = null
      for (const s of trip.stops) {
        const st = stationOf(trip.region, s.stopId)
        const key = `${trip.region}:${st.id}`
        if (!rows.has(key)) {
          rows.set(key, { id: st.id, region: trip.region, name: st.name, departures: [] })
          order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, key)
        }
        prev = key
        const d = toDeparture(trip, s, ctx, vehicles)
        if (d) rows.get(key)!.departures.push(d)
      }
    }
    const list = order
      .map((k) => rows.get(k)!)
      .map((r) => ({ ...r, departures: r.departures.sort((a, b) => a.time - b.time).slice(0, perStop) }))
    // Drop a trip's final stop when nothing departs from it (it's only an arrival).
    while (list.length && !list[list.length - 1].departures.length) list.pop()
    out.push({
      direction: g.direction,
      headsigns: [...g.heads.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h),
      trips: g.trips.length,
      stops: list,
    })
  }
  return out.sort((a, b) => (a.direction ?? 9) - (b.direction ?? 9))
}
