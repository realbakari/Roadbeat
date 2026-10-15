import ROUTE_DATA from '../data/translink-routes.json'
import { decodeFeed, num, parseTripUpdates, parseVehicles, routeCode, rt } from './gtfsrt'
import type { LiveVehicle, TransitRegion, TripUpdates, VehicleMode } from './transitTypes'

export type { LiveVehicle, StopTime, TransitRegion, TripUpdate, TripUpdates, VehicleMode } from './transitTypes'

// TransLink GTFS-RT (data.qld.gov.au "Translink real time data"). The feeds are
// protobuf and send no CORS headers, so they're read through /translink-rt
// (see vite.config.ts and functions/translink-rt).
const BASE = import.meta.env.VITE_TRANSLINK_RT_BASE ?? '/translink-rt'


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


async function feed(region: TransitRegion, name: 'VehiclePositions' | 'TripUpdates' | 'alerts', signal?: AbortSignal) {
  const res = await fetch(`${BASE}/${region}/${name}`, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`TransLink responded with ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  // A static host without the proxy serves index.html here instead of protobuf.
  if (type.includes('text/html')) throw new Error('TransLink proxy is not configured')
  return decodeFeed(new Uint8Array(await res.arrayBuffer()))
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

export async function fetchVehicles(regions: TransitRegion[], signal?: AbortSignal): Promise<LiveVehicle[]> {
  const feeds = await Promise.all(regions.map((r) => feed(r, 'VehiclePositions', signal).then((f) => [r, f] as const)))
  return feeds.flatMap(([region, f]) => parseVehicles(region, f, routeInfo))
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
  const parts = feeds.map(([region, f]) => parseTripUpdates(region, f))
  return { at: Object.assign({}, ...parts.map((p) => p.at)), trips: parts.flatMap((p) => p.trips) }
}
