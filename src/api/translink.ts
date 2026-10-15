import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import ROUTE_DATA from '../data/translink-routes.json'

// TransLink GTFS-RT (data.qld.gov.au "Translink real time data"). The feeds are
// protobuf and send no CORS headers, so they're read through /translink-rt
// (see vite.config.ts and functions/translink-rt).
const BASE = import.meta.env.VITE_TRANSLINK_RT_BASE ?? '/translink-rt'

const rt = GtfsRealtimeBindings.transit_realtime
type Long = { toNumber(): number } | number | null | undefined

export type TransitRegion = 'SEQ' | 'CNS'
export type VehicleMode = 'bus' | 'train' | 'tram' | 'ferry'

export interface LiveVehicle {
  id: string
  region: TransitRegion
  mode: VehicleMode
  /** Route code from the feed: "402", "F1", "L1", or a train code like "BRCA". */
  route: string
  routeId: string
  /** GTFS trip id the vehicle reports it is running, if any. */
  tripId: string | null
  /** Official T-line for trains ("T1 Caboolture"), else null. */
  lineName: string | null
  /** Official route name from TransLink ("Brisbane City - Caboolture", "Toowong - University of Qld"). */
  routeName: string | null
  color: string | null
  label: string | null
  position: [number, number]
  bearing: number | null
  status: 'stopped' | 'arriving' | 'moving' | null
  stopId: string | null
  timestamp: number
}

export interface TransitAlert {
  id: string
  region: TransitRegion
  header: string
  description: string
  url: string | null
  cause: string
  effect: string
  /** Route codes this alert affects ("402", "BRCA", "F1"…), de-duplicated. */
  routes: string[]
  stops: number
  periods: { start: number | null; end: number | null }[]
}

const num = (v: Long) => (v == null ? null : typeof v === 'number' ? v : v.toNumber())

async function feed(region: TransitRegion, name: 'VehiclePositions' | 'TripUpdates' | 'alerts', signal?: AbortSignal) {
  const res = await fetch(`${BASE}/${region}/${name}`, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`TransLink responded with ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  // A static host without the proxy serves index.html here instead of protobuf.
  if (type.includes('text/html')) throw new Error('TransLink proxy is not configured')
  return rt.FeedMessage.decode(new Uint8Array(await res.arrayBuffer()))
}

/** "402-4596" → "402"; Queensland Rail route ids are origin+destination codes like "BRCA". */
function routeCode(routeId: string) {
  return routeId.replace(/-\d+$/, '')
}

export interface RouteInfo {
  short: string
  long: string
  mode: VehicleMode
  color: string | null
  url: string | null
  /** Queensland Rail T-line, e.g. "T1 Caboolture" (official T-code mapping). */
  line?: string
}

const ROUTES = (ROUTE_DATA as { routes: Record<string, RouteInfo> }).routes

/** Official route details from TransLink's published GTFS (see scripts/build-routes.mjs). */
export function routeInfo(code: string, region: TransitRegion = 'SEQ'): RouteInfo | null {
  return ROUTES[`${region}:${code}`] ?? (region === 'SEQ' ? null : (ROUTES[`SEQ:${code}`] ?? null))
}

/** Every SEQ route code in the published data. */
export function allRouteCodes(): string[] {
  return Object.keys(ROUTES)
    .filter((k) => k.startsWith('SEQ:'))
    .map((k) => k.slice(4))
}

export function modeOf(code: string, region: TransitRegion = 'SEQ'): VehicleMode {
  return routeInfo(code, region)?.mode ?? 'bus'
}

/** How riders name a route: "T1 Caboolture" for trains, else the route number ("402", "F1"). */
export function routeLabel(code: string, region: TransitRegion = 'SEQ') {
  const r = routeInfo(code, region)
  return r?.line ?? r?.short ?? code
}

const STATUS = {
  [rt.VehiclePosition.VehicleStopStatus.STOPPED_AT]: 'stopped',
  [rt.VehiclePosition.VehicleStopStatus.INCOMING_AT]: 'arriving',
  [rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO]: 'moving',
} as Record<number, LiveVehicle['status']>

export async function fetchVehicles(regions: TransitRegion[], signal?: AbortSignal): Promise<LiveVehicle[]> {
  const feeds = await Promise.all(regions.map((r) => feed(r, 'VehiclePositions', signal).then((f) => [r, f] as const)))
  const out: LiveVehicle[] = []
  for (const [region, f] of feeds) {
    for (const e of f.entity) {
      const v = e.vehicle
      const p = v?.position
      if (!v || !p || !p.latitude || !p.longitude) continue
      const routeId = v.trip?.routeId ?? ''
      const code = routeCode(routeId)
      const info = routeInfo(code, region)
      out.push({
        id: `${region}-${v.vehicle?.id ?? e.id}`,
        region,
        mode: info?.mode ?? 'bus',
        route: code || '?',
        routeId,
        tripId: v.trip?.tripId || null,
        lineName: info?.line ?? null,
        routeName: info?.long || null,
        color: info?.color ?? null,
        label: v.vehicle?.label || null,
        position: [p.longitude, p.latitude],
        bearing: p.bearing ?? null,
        status: v.currentStatus != null ? (STATUS[v.currentStatus] ?? null) : null,
        stopId: v.stopId || null,
        timestamp: (num(v.timestamp) ?? 0) * 1000,
      })
    }
  }
  return out
}

const enumName = (e: Record<string, number>, v: number | null | undefined, fallback: string) => {
  const name = Object.keys(e).find((k) => e[k] === v)
  return (name ?? fallback)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

const text = (t: { translation?: { text?: string | null; language?: string | null }[] | null } | null | undefined) =>
  t?.translation?.find((x) => !x.language || x.language.startsWith('en'))?.text?.trim() ?? ''

export async function fetchTransitAlerts(regions: TransitRegion[], signal?: AbortSignal): Promise<TransitAlert[]> {
  const feeds = await Promise.all(regions.map((r) => feed(r, 'alerts', signal).then((f) => [r, f] as const)))
  const out: TransitAlert[] = []
  for (const [region, f] of feeds) {
    for (const e of f.entity) {
      const a = e.alert
      if (!a) continue
      const entities = a.informedEntity ?? []
      out.push({
        id: `${region}-${e.id}`,
        region,
        header: text(a.headerText),
        description: text(a.descriptionText),
        url: text(a.url) || null,
        cause: enumName(rt.Alert.Cause as unknown as Record<string, number>, a.cause, 'Unknown cause'),
        effect: enumName(rt.Alert.Effect as unknown as Record<string, number>, a.effect, 'Unknown effect'),
        routes: [...new Set(entities.map((x) => (x.routeId ? routeCode(x.routeId) : '')).filter(Boolean))],
        stops: entities.filter((x) => x.stopId).length,
        periods: (a.activePeriod ?? []).map((p) => ({
          start: num(p.start) != null ? num(p.start)! * 1000 : null,
          end: num(p.end) != null && num(p.end) !== 0 ? num(p.end)! * 1000 : null,
        })),
      })
    }
  }
  return out
}

/** Active now if any period contains `now` (no periods means always active). */
export function alertActive(a: TransitAlert, now = Date.now()) {
  if (!a.periods.length) return true
  return a.periods.some((p) => (p.start == null || p.start <= now) && (p.end == null || now < p.end))
}

/** Next period that starts after now, for upcoming alerts. */
export function alertNextStart(a: TransitAlert, now = Date.now()) {
  const starts = a.periods.map((p) => p.start).filter((s): s is number => s != null && s > now)
  return starts.length ? Math.min(...starts) : null
}

/** One stop on a trip as TransLink's real-time feed reports it. */
export interface StopTime {
  stopId: string
  sequence: number | null
  /** Reported departure time (ms), or arrival time when only arrival is given. */
  time: number | null
  /** True when only an arrival is reported (e.g. the trip ends here). */
  arrivalOnly: boolean
  /** Reported delay in seconds against the timetable (negative = early), or null. */
  delay: number | null
  skipped: boolean
}

export interface TripUpdate {
  key: string
  region: TransitRegion
  tripId: string
  route: string
  routeId: string
  relationship: 'scheduled' | 'added' | 'unscheduled' | 'cancelled' | 'replacement' | 'duplicated'
  /** Remaining stops in order, as listed in the feed. */
  stops: StopTime[]
}

export interface TripUpdates {
  /** Feed timestamps (ms) by region. */
  at: Partial<Record<TransitRegion, number>>
  trips: TripUpdate[]
}

const TRIP_REL: Record<number, TripUpdate['relationship']> = {
  [rt.TripDescriptor.ScheduleRelationship.SCHEDULED]: 'scheduled',
  [rt.TripDescriptor.ScheduleRelationship.ADDED]: 'added',
  [rt.TripDescriptor.ScheduleRelationship.UNSCHEDULED]: 'unscheduled',
  [rt.TripDescriptor.ScheduleRelationship.CANCELED]: 'cancelled',
  5: 'replacement',
  6: 'duplicated',
}

/** GTFS-RT TripUpdates: TransLink's real-time stop times for running and about-to-start trips. */
export async function fetchTripUpdates(regions: TransitRegion[], signal?: AbortSignal): Promise<TripUpdates> {
  // Each region on its own, with a time limit, so a slow Cairns feed doesn't hold up Brisbane's.
  const settled = await Promise.allSettled(
    regions.map((r) => {
      const s = signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000)
      return feed(r, 'TripUpdates', s).then((f) => [r, f] as const)
    }),
  )
  const feeds = settled.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []))
  if (!feeds.length) throw (settled[0] as PromiseRejectedResult).reason
  const out: TripUpdates = { at: {}, trips: [] }
  for (const [region, f] of feeds) {
    out.at[region] = (num(f.header?.timestamp) ?? 0) * 1000
    for (const e of f.entity) {
      const u = e.tripUpdate
      const tripId = u?.trip?.tripId
      if (!u || !tripId) continue
      const routeId = u.trip.routeId ?? ''
      out.trips.push({
        key: `${region}-${tripId}`,
        region,
        tripId,
        route: routeCode(routeId),
        routeId,
        relationship: TRIP_REL[u.trip.scheduleRelationship ?? 0] ?? 'scheduled',
        stops: (u.stopTimeUpdate ?? [])
          .filter((s) => s.stopId)
          .map((s) => {
            const ev = s.departure?.time != null ? s.departure : s.arrival
            const t = num(ev?.time)
            return {
              stopId: s.stopId!,
              sequence: s.stopSequence ?? null,
              time: t ? t * 1000 : null,
              arrivalOnly: s.departure?.time == null,
              delay: ev?.delay ?? null,
              skipped: s.scheduleRelationship === rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED,
            }
          }),
      })
    }
  }
  return out
}
