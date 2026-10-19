import type { TransitRegion } from './transitTypes.js'

// Stop names and trip headsigns from Translink's published GTFS (see
// scripts/build-stops.mjs). Loaded on demand: SEQ and Cairns rail/tram/ferry
// stops are small; bus stops, the other regional networks' stops and the trip
// table are fetched only when something needs them.

export interface Stop {
  id: string
  region: TransitRegion
  name: string
  position: [number, number]
  /** Parent station id ("place_albsta"), or null. */
  parent: string | null
  /** Official platform code ("2"), or null. */
  platform: string | null
}

type StopRow = [string, string, number, number, string | 0, string | 0]
export type StopFile = { stops: Partial<Record<TransitRegion, StopRow[]>> }

export class StopIndex {
  private byKey = new Map<string, Stop>()
  private kids = new Map<string, Stop[]>()
  add(file: StopFile) {
    for (const [region, rows] of Object.entries(file.stops) as [TransitRegion, StopRow[]][]) {
      for (const [id, name, lat, lng, parent, platform] of rows) {
        const s: Stop = { id, region, name, position: [lng, lat], parent: parent || null, platform: platform || null }
        this.byKey.set(`${region}:${id}`, s)
        if (s.parent) {
          const k = `${region}:${s.parent}`
          this.kids.set(k, [...(this.kids.get(k) ?? []), s])
        }
      }
    }
    return this
  }

  all(): Iterable<Stop> {
    return this.byKey.values()
  }

  get(region: TransitRegion, id: string | null | undefined) {
    return id ? (this.byKey.get(`${region}:${id}`) ?? null) : null
  }

  children(s: Stop) {
    return this.kids.get(`${s.region}:${s.id}`) ?? []
  }

  /** The station a platform belongs to, or the stop itself. */
  station(s: Stop) {
    return (s.parent && this.get(s.region, s.parent)) || s
  }
}

let core: Promise<StopIndex> | null = null
let full: Promise<StopIndex> | null = null

/** SEQ and Cairns train, tram and ferry stops; with `withBus`, every stop in every region (a larger download). */
export function loadStops(withBus: boolean): Promise<StopIndex> {
  core ??= import('../data/translink-stops.json').then((m) => new StopIndex().add(m.default as unknown as StopFile))
  if (!withBus) return full ?? core
  full ??= Promise.all([
    import('../data/translink-stops.json'),
    import('../data/translink-stops-bus.json'),
    import('../data/translink-stops-regional.json'),
  ]).then((files) => files.reduce((index, f) => index.add(f.default as unknown as StopFile), new StopIndex()))
  return full
}

export interface TripInfo {
  /** Official headsign ("Caboolture station"). */
  headsign: string
  /** GTFS direction_id. */
  direction: 0 | 1
}

export type TripFile = { trips: Partial<Record<TransitRegion, { headsigns: string[]; ids: string; info: string }>> }

export class TripIndex {
  private maps = new Map<TransitRegion, { headsigns: string[]; trips: Map<number, number> }>()
  constructor(file: TripFile) {
    for (const [region, t] of Object.entries(file.trips) as [TransitRegion, TripFile['trips']['SEQ'] & {}][]) {
      const trips = new Map<number, number>()
      const info = t.info.split(',')
      let n = 0
      t.ids.split(',').forEach((d, i) => {
        n += parseInt(d, 36)
        trips.set(n, parseInt(info[i], 36))
      })
      this.maps.set(region, { headsigns: t.headsigns, trips })
    }
  }

  /** Headsign and direction for a GTFS trip id, or null for trips not in the published timetable. */
  get(region: TransitRegion, tripId: string | null | undefined): TripInfo | null {
    const m = this.maps.get(region)
    const v = tripId && m?.trips.get(Number(tripId.split('-')[0]))
    if (v == null || v === '') return null
    return { headsign: m!.headsigns[v >> 1], direction: (v & 1) as 0 | 1 }
  }
}

let trips: Promise<TripIndex> | null = null
export function loadTrips() {
  trips ??= import('../data/translink-trips.json').then((m) => new TripIndex(m.default as unknown as TripFile))
  return trips
}
