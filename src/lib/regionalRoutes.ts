import type { TimetableIndex } from '../api/timetables'
import { TRANSIT_REGIONS, type TransitRegion, type VehicleMode } from '../api/transitTypes'
import { REGION_NAMES } from './transitRegions'

/** A route outside SEQ, whose lines TransLink's network status doesn't list. */
export interface RegionRoute {
  region: TransitRegion
  code: string
  /** Route number as TransLink publishes it ("200"). */
  short: string
  /** Official route name ("Ferry Terminal - City, Stockland and Kelso"). */
  long: string
  mode: VehicleMode
  color: string | null
}

export type RouteLookup = (code: string, region: TransitRegion) => { short: string; long: string; mode: VehicleMode; color: string | null } | null

const byNumber = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

/** These route codes of one region with their published names, by route number. */
export function regionRoutes(region: TransitRegion, codes: string[], info: RouteLookup): RegionRoute[] {
  return codes
    .map((code) => {
      const r = info(code, region)
      return { region, code, short: r?.short ?? code, long: r?.long ?? '', mode: r?.mode ?? 'bus', color: r?.color ?? null }
    })
    .sort((a, b) => byNumber(a.short, b.short))
}

/** Every route outside SEQ in the published timetable, by region (in TRANSIT_REGIONS order) then route number. */
export function regionalRoutes(index: TimetableIndex, info: RouteLookup): RegionRoute[] {
  return TRANSIT_REGIONS.filter((r) => r !== 'SEQ').flatMap((region) => regionRoutes(region, index.regions[region]?.routes ?? [], info))
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Routes matching a search: by route number ("200"), by region name, every
 * route in it ("townsville"), or by words in the route name ("kelso").
 */
export function searchRoutes(routes: RegionRoute[], query: string, limit = 6): RegionRoute[] {
  const q = norm(query)
  if (q.length < 2) return []
  const score = (r: RegionRoute) =>
    norm(r.short) === q ? 0 : norm(REGION_NAMES[r.region]).startsWith(q) ? 1 : ` ${norm(r.long)}`.includes(` ${q}`) ? 2 : null
  return routes
    .flatMap((r) => {
      const s = score(r)
      return s == null ? [] : [{ r, s }]
    })
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.r)
}
