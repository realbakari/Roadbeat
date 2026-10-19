import type { FuelStation } from '../api/fuelStations'
import { storedList } from './storedList'

// The fuel layer's brands, as Fuel Prices Queensland names them ("Ampol",
// "7 Eleven", "Independent"), and the fuel whose price the map labels. Brands
// are shown as their names only: the source publishes no logos, and Roadbeat
// doesn't copy the companies' artwork.

/** Each brand with how many stations carry it, most first, then by name. */
export function brandCounts(stations: FuelStation[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const s of stations) if (s.brand) counts.set(s.brand, (counts.get(s.brand) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** The stations of the chosen brands, or every station when none is chosen. */
export function byBrand(stations: FuelStation[], brands: string[]): FuelStation[] {
  if (!brands.length) return stations
  const chosen = new Set(brands)
  return stations.filter((s) => s.brand != null && chosen.has(s.brand))
}

/** A station's name with its brand, unless the name already says it: "Mobil Gordonvale", "Ampol · Dalby Truck Stop". */
export function brandedName(s: FuelStation): string {
  if (!s.brand || s.brand === 'Independent') return s.name
  const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
  return plain(s.name).includes(plain(s.brand)) ? s.name : `${s.brand} · ${s.name}`
}

const store = storedList<string>('qldt-fuel-brands', (x): x is string => typeof x === 'string')
/** The brands the fuel layer is narrowed to in this browser; empty for all. */
export const useFuelBrands = store.use
export const setFuelBrands = (brands: string[]) => store.write(brands)

/** The fuels a map label can show, most stations first: every fuel any station reports. */
export function fuelNames(stations: FuelStation[]): string[] {
  const counts = new Map<string, number>()
  for (const s of stations) for (const f of s.fuels) counts.set(f.name, (counts.get(f.name) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n)
}

/** A station's map label for a fuel: its price, "Out" when reported unavailable, or null when it doesn't report that fuel. */
export function priceLabel(s: FuelStation, fuel: string): string | null {
  const f = s.fuels.find((x) => x.name === fuel)
  if (!f) return null
  return f.cents != null ? f.cents.toFixed(1) : 'Out'
}

/** What the map labels stations with until someone chooses: the fuel most stations sell. */
export const DEFAULT_PRICE_LABEL = 'Unleaded'

const labelStore = storedList<string>('qldt-fuel-label', (x): x is string => typeof x === 'string')
/** The fuel whose price labels the map in this browser, or '' for no labels. */
export const useFuelLabel = (): string => labelStore.use()[0] ?? DEFAULT_PRICE_LABEL
export const setFuelLabel = (fuel: string) => labelStore.write([fuel])

/** A map view's bounds as [[west, south], [east, north]]. */
export type ViewBounds = [[number, number], [number, number]]

/**
 * How old a reported price can be and still count as the cheapest. Retailers
 * report every change within 30 minutes, so a price unchanged for this long
 * may be a station that has stopped reporting; it's still shown, faded, with
 * its age, but never called the cheapest.
 */
export const FRESH_DAYS = 30

/** Whether a price was reported within FRESH_DAYS of `now`. */
export const isFresh = (reportedAt: number, now: number) => now - reportedAt <= FRESH_DAYS * 86_400_000

/**
 * The lowest reported price of `fuel` among the stations in view, and every
 * station at that price (ties are all marked). Unavailable fuels and prices
 * older than FRESH_DAYS don't count; null when no station in view has one.
 */
export function cheapestIn(stations: FuelStation[], fuel: string, bounds: ViewBounds | null, now: number): { cents: number; ids: Set<string>; stations: FuelStation[] } | null {
  if (!fuel) return null
  let best: number | null = null
  let at: FuelStation[] = []
  for (const s of stations) {
    const [lng, lat] = s.position
    if (bounds && (lng < bounds[0][0] || lng > bounds[1][0] || lat < bounds[0][1] || lat > bounds[1][1])) continue
    const f = s.fuels.find((x) => x.name === fuel)
    if (!f || f.cents == null || !isFresh(f.reportedAt, now)) continue
    const cents = f.cents
    if (best == null || cents < best) {
      best = cents
      at = [s]
    } else if (cents === best) at.push(s)
  }
  return best == null ? null : { cents: best, ids: new Set(at.map((s) => s.id)), stations: at }
}
