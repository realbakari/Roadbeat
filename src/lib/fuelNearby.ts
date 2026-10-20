import type { FuelPrice, FuelStation } from '../api/fuelStations'
import { distanceKm, type LngLat } from './distance'
import { titleCase } from './format'
import { isFresh } from './fuelBrands'

// The timeline's Fuel tab: the stations near a point that report a chosen
// fuel, with each one's price as its retailer last reported it. The point is
// the reader's own location or a suburb the state files stations under, so no
// address is looked up anywhere. A price older than FRESH_DAYS is shown with
// its age but never called the cheapest; a fuel reported unavailable says so.

export type FuelSort = 'cheapest' | 'nearest'

/** How far around the point to look, in kilometres. */
export const FUEL_RADII = [5, 10, 25] as const
export type FuelRadius = (typeof FUEL_RADII)[number]

export interface FuelRow {
  station: FuelStation
  price: FuelPrice
  km: number
  /** Reported within FRESH_DAYS. */
  fresh: boolean
  /** At the lowest fresh, available price among the rows. */
  cheapest: boolean
}

/** Where the rows are measured from: the reader's location, or a suburb's stations' centre. */
export interface FuelOrigin {
  center: LngLat
  label: string
  kind: 'me' | 'area'
}

const rank = (r: FuelRow) => (!r.price.available ? 2 : r.fresh ? 0 : 1)

/**
 * The stations within `radiusKm` of `origin` that report `fuel`. Cheapest
 * puts fresh available prices first (lowest first, then nearest), then older
 * prices, then those reported unavailable; nearest is by distance alone.
 */
export function fuelNear(stations: FuelStation[], fuel: string, origin: LngLat, radiusKm: number, sort: FuelSort, now: number): FuelRow[] {
  const rows: FuelRow[] = []
  for (const station of stations) {
    const price = station.fuels.find((f) => f.name === fuel)
    if (!price) continue
    const km = distanceKm(origin, station.position)
    if (km > radiusKm) continue
    rows.push({ station, price, km, fresh: isFresh(price.reportedAt, now), cheapest: false })
  }
  const lowest = Math.min(...rows.filter((r) => r.fresh && r.price.cents != null).map((r) => r.price.cents ?? Infinity))
  for (const r of rows) r.cheapest = r.fresh && r.price.cents === lowest
  return rows.sort((a, b) =>
    sort === 'nearest' ? a.km - b.km : rank(a) - rank(b) || (a.price.cents ?? 0) - (b.price.cents ?? 0) || a.km - b.km,
  )
}

/** A suburb the state files stations under, to measure from when the reader doesn't share their location. */
export interface FuelArea {
  name: string
  postcode: string | null
  /** The middle of its stations. */
  center: LngLat
  stations: number
}

/** Every suburb and postcode in the station list, with the middle of its stations. */
export function fuelAreas(stations: FuelStation[]): FuelArea[] {
  const by = new Map<string, { name: string; postcode: string | null; lng: number; lat: number; n: number }>()
  for (const s of stations) {
    if (!s.suburb) continue
    const name = titleCase(s.suburb) ?? s.suburb
    const key = `${name}|${s.postcode ?? ''}`
    const a = by.get(key) ?? { name, postcode: s.postcode, lng: 0, lat: 0, n: 0 }
    a.lng += s.position[0]
    a.lat += s.position[1]
    a.n += 1
    by.set(key, a)
  }
  return [...by.values()]
    .map((a) => {
      const center: LngLat = [a.lng / a.n, a.lat / a.n]
      return { name: a.name, postcode: a.postcode, center, stations: a.n }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The suburbs matching what's typed: by the start of the name or postcode first, then anywhere in the name. */
export function matchAreas(areas: FuelArea[], typed: string, limit = 8): FuelArea[] {
  const q = typed.trim().toLowerCase()
  if (!q) return []
  const starts = areas.filter((a) => a.name.toLowerCase().startsWith(q) || a.postcode?.startsWith(q))
  const within = areas.filter((a) => !starts.includes(a) && a.name.toLowerCase().includes(q))
  return [...starts, ...within].slice(0, limit)
}
