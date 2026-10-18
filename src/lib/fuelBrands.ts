import type { FuelStation } from '../api/fuelAvailability'
import { storedList } from './storedList'

// The fuel layer's brands, as the source names them ("Ampol", "7 Eleven",
// "Independent"). Brands are shown as their names only: the source publishes
// no logos, and Roadbeat doesn't copy the companies' artwork.

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
