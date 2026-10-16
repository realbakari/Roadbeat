import { parseBushfires, type FireWarning } from '../../src/api/bushfireFeed.js'
import { decodeFeed, parseTripUpdates, parseVehicles, type RouteLookup } from '../../src/api/gtfsrt.js'
import { StopIndex, TripIndex, type StopFile, type TripFile } from '../../src/api/stops.js'
import type { LiveVehicle, TransitRegion, TripUpdates } from '../../src/api/transitTypes.js'
import type { EventProperties, FeatureCollection, TrafficEvent } from '../../src/api/types.js'
import routeData from '../../src/data/translink-routes.json' with { type: 'json' }
import stopsCore from '../../src/data/translink-stops.json' with { type: 'json' }
import stopsBus from '../../src/data/translink-stops-bus.json' with { type: 'json' }
import tripsData from '../../src/data/translink-trips.json' with { type: 'json' }

// Live official feeds for the server functions, fetched directly (servers need
// no CORS proxy) and cached briefly in memory so a burst of requests to one warm
// function reaches each source once.

const SOURCES = {
  events: 'https://data.qldtraffic.qld.gov.au/events_v2.geojson',
  bushfires: 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json',
  translink: 'https://gtfsrt.api.translink.com.au/api/realtime',
} as const

const cache = new Map<string, { at: number; value: Promise<unknown> }>()

/** Runs `load` at most once per `ttlMs` for `key`; a failed load is retried on the next call. */
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>
  const value = load().catch((e: unknown) => {
    cache.delete(key)
    throw e
  })
  cache.set(key, { at: Date.now(), value })
  return value
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${new URL(url).host} responded with ${res.status}`)
  return res
}

/** QLDTraffic road events, as published, with the feed's own `published` stamp. */
export function roadEvents(): Promise<{ events: TrafficEvent[]; fetchedAt: number; published: string | null }> {
  return cached('events', 60_000, async () => {
    const data = (await (await get(SOURCES.events)).json()) as FeatureCollection<TrafficEvent['geometry'], EventProperties>
    return { events: data.features ?? [], fetchedAt: Date.now(), published: data.published ?? null }
  })
}

/** Queensland Fire Department warnings and incidents, highest level first. */
export function bushfires(): Promise<{ fires: FireWarning[]; fetchedAt: number }> {
  return cached('bushfires', 120_000, async () => ({ fires: parseBushfires(await (await get(SOURCES.bushfires)).json()), fetchedAt: Date.now() }))
}

const ROUTES = (routeData as { routes: Record<string, { short: string; long: string; mode: LiveVehicle['mode']; color: string | null; line?: string }> }).routes

/** Official route details from TransLink's published GTFS. Mirrors routeInfo() in src/api/translink.ts. */
export const routeInfo: RouteLookup & ((code: string, region: TransitRegion) => (typeof ROUTES)[string] | null) = (code, region) =>
  ROUTES[`${region}:${code}`] ?? (region === 'SEQ' ? null : (ROUTES[`SEQ:${code}`] ?? null))

async function translinkFeed(region: TransitRegion, name: 'TripUpdates' | 'VehiclePositions') {
  return decodeFeed(new Uint8Array(await (await get(`${SOURCES.translink}/${region}/${name}`)).arrayBuffer()))
}

/** TransLink real-time trip updates and vehicle positions for one region. */
export function transitRealtime(region: TransitRegion): Promise<{ updates: TripUpdates; vehicles: LiveVehicle[] }> {
  return cached(`rt-${region}`, 30_000, async () => {
    const [trips, vehicles] = await Promise.all([translinkFeed(region, 'TripUpdates'), translinkFeed(region, 'VehiclePositions')])
    return { updates: parseTripUpdates(region, trips), vehicles: parseVehicles(region, vehicles, routeInfo) }
  })
}

// The published stop and trip tables are build artifacts of scripts/build-stops.mjs, in the shape StopIndex reads.
export const stops = new StopIndex().add(stopsCore as unknown as StopFile).add(stopsBus as unknown as StopFile)
export const trips = new TripIndex(tripsData as unknown as TripFile)
