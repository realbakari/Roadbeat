import { z } from 'zod'
import type { LngLat } from '../lib/distance.js'

// Queensland service stations and their fuel prices, from the state's Fuel
// Prices Queensland Direct API (the Fuel Price Reporting scheme: retailers
// report a price change within 30 minutes). Roadbeat is a licensed publisher.
// The API needs a subscriber token, so Roadbeat's server reads it
// (api/_lib/endpoints/fuel.ts, with the FPQ_API_TOKEN setting) and the app
// reads /api/fuel. The licence lets Roadbeat publish the data but requires:
// prices current within 30 minutes and site details within 24 hours, the
// state's notice (FUEL_NOTICE) wherever it's shown, a ban on further
// publication, no implied endorsement, and the data kept apart from other
// sources. So prices stay out of Roadbeat's public API and MCP server.

export const FUEL_URL = '/api/fuel'
export const FPQ_API = 'https://fppdirectapi-prod.fuelpricesqld.com.au'

/** The licence's notice for data products (clause 4.3), with the year it applies to. */
export function fuelNotice(year: number): string {
  return `Based on or contains data provided by the State of Queensland (Department of Energy and Climate) ${year}. In consideration of the State permitting use of this data you acknowledge and agree that the State gives no warranty in relation to the data (including accuracy, reliability, completeness, currency or suitability) and accepts no liability (including without limitation, liability in negligence) for any loss, damage or costs (including consequential damage) relating to any use of the data. Data must not be used for direct marketing or be used in breach of the privacy laws.`
}

/** The licence's ban on further publication (clause 2.3), said wherever prices are shown. */
export const FUEL_NO_REPUBLISH = 'Prices may not be republished.'

/** The API's price for a fuel the site has run out of: "the product is currently unavailable at the site". */
const UNAVAILABLE = 9999

/** Fuels in the order a station page lists them; any other fuel the state adds comes after, in its own order. */
const FUEL_ORDER = ['Unleaded', 'e10', 'Premium Unleaded 95', 'Premium Unleaded 98', 'Premium e5', 'Diesel', 'Premium Diesel', 'ULSD', 'Bio-Diesel 20', 'LPG', 'e85', 'LRP', 'OPAL']

export type FuelStatus = 'available' | 'partial' | 'unavailable' | 'unknown'

export const FUEL_STATUS_LABEL: Record<FuelStatus, string> = {
  available: 'Fuel available',
  partial: 'Some fuels unavailable',
  unavailable: 'No fuel available',
  unknown: 'No fuels reported',
}

export interface FuelPrice {
  /** The state's fuel id. */
  id: number
  /** The state's fuel name, e.g. "Premium Unleaded 95". */
  name: string
  /** Cents a litre, as reported; null when the fuel is reported unavailable. */
  cents: number | null
  available: boolean
  /** When the retailer reported it (the API's UTC timestamp). */
  reportedAt: number
}

export interface FuelStation {
  /** The state's site id, as a string for links. */
  id: string
  name: string
  brand: string | null
  address: string | null
  postcode: string | null
  /** The suburb the state files the site under. */
  suburb: string | null
  /** Every available or unavailable fuel the site reports, in FUEL_ORDER. */
  fuels: FuelPrice[]
  status: FuelStatus
  position: LngLat
}

const text = z
  .string()
  .nullish()
  .catch(null)
  .transform((v) => v?.trim() || null)

const Brands = z.object({ Brands: z.array(z.object({ BrandId: z.number(), Name: z.string() }).catch({ BrandId: -1, Name: '' })) })
const Fuels = z.object({ Fuels: z.array(z.object({ FuelId: z.number(), Name: z.string() }).catch({ FuelId: -1, Name: '' })) })
const Regions = z.object({ GeographicRegions: z.array(z.object({ GeoRegionLevel: z.number(), GeoRegionId: z.number(), Name: z.string() }).catch({ GeoRegionLevel: -1, GeoRegionId: -1, Name: '' })) })
const Site = z.object({ S: z.number(), N: text, A: text, P: text, B: z.number().nullish().catch(null), G1: z.number().nullish().catch(null), Lat: z.number(), Lng: z.number() })
const Sites = z.object({ S: z.array(z.unknown()) })
const Price = z.object({ SiteId: z.number(), FuelId: z.number(), TransactionDateUtc: z.string(), Price: z.number() })
const Prices = z.object({ SitePrices: z.array(z.unknown()) })

/** The API's UTC timestamp ("2026-09-19T21:09:50.913", no zone given) as epoch ms, or null if unreadable. */
function utc(s: string): number | null {
  const t = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`)
  return Number.isFinite(t) ? t : null
}

/** What a site's reported fuels add up to, in the state's own terms: none, some or all of them unavailable. */
export function fuelStatus(fuels: FuelPrice[]): FuelStatus {
  if (!fuels.length) return 'unknown'
  const out = fuels.filter((f) => !f.available).length
  return out === 0 ? 'available' : out === fuels.length ? 'unavailable' : 'partial'
}

/**
 * The four API answers as stations with their prices. Sites without a point
 * in Queensland's rough bounds, prices with no readable time and entries of
 * the wrong shape are left out; a site with no prices is kept, with no fuels.
 */
export function parseFuelData(raw: { brands: unknown; fuels: unknown; regions: unknown; sites: unknown; prices: unknown }): FuelStation[] {
  const brands = new Map(Brands.parse(raw.brands).Brands.map((b) => [b.BrandId, b.Name.trim()]))
  const fuelNames = new Map(Fuels.parse(raw.fuels).Fuels.map((f) => [f.FuelId, f.Name.trim()]))
  const suburbs = new Map(Regions.parse(raw.regions).GeographicRegions.filter((r) => r.GeoRegionLevel === 1).map((r) => [r.GeoRegionId, r.Name.trim()]))
  const bySite = new Map<number, FuelPrice[]>()
  for (const p of Prices.parse(raw.prices).SitePrices) {
    const r = Price.safeParse(p)
    if (!r.success) continue
    const name = fuelNames.get(r.data.FuelId)
    const reportedAt = utc(r.data.TransactionDateUtc)
    if (!name || reportedAt == null || !(r.data.Price > 0)) continue
    const available = r.data.Price !== UNAVAILABLE
    // Tenths of a cent a litre: 1899 is 189.9.
    const fuel = { id: r.data.FuelId, name, cents: available ? r.data.Price / 10 : null, available, reportedAt }
    bySite.set(r.data.SiteId, [...(bySite.get(r.data.SiteId) ?? []), fuel])
  }
  const rank = (name: string) => {
    const i = FUEL_ORDER.indexOf(name)
    return i < 0 ? FUEL_ORDER.length : i
  }
  const out: FuelStation[] = []
  for (const s of Sites.parse(raw.sites).S) {
    const r = Site.safeParse(s)
    if (!r.success) continue
    const { S, N, A, P, B, G1, Lat, Lng } = r.data
    if (Lat > -9 || Lat < -30 || Lng < 137 || Lng > 154) continue
    const fuels = (bySite.get(S) ?? []).sort((a, b) => rank(a.name) - rank(b.name) || a.id - b.id)
    out.push({
      id: String(S),
      name: N ?? 'Service station',
      brand: (B != null && brands.get(B)) || null,
      address: A,
      postcode: P,
      suburb: (G1 != null && suburbs.get(G1)) || null,
      fuels,
      status: fuelStatus(fuels),
      position: [Lng, Lat],
    })
  }
  return out
}

/** "189.9" for a price in cents a litre. */
export function centsText(cents: number): string {
  return cents.toFixed(1)
}

const Station = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  address: z.string().nullable(),
  postcode: z.string().nullable(),
  suburb: z.string().nullable(),
  fuels: z.array(z.object({ id: z.number(), name: z.string(), cents: z.number().nullable(), available: z.boolean(), reportedAt: z.number() })),
  status: z.enum(['available', 'partial', 'unavailable', 'unknown']),
  position: z.tuple([z.number(), z.number()]),
})

/** Every station, from Roadbeat's /api/fuel, with when the server read the prices. */
export async function fetchFuelStations(signal?: AbortSignal): Promise<FuelStation[]> {
  const res = await fetch(FUEL_URL, { signal })
  if (!res.ok) throw new Error(res.status === 503 ? "Fuel prices aren't set up on this server" : `Fuel prices responded with ${res.status}`)
  const body = z.object({ stations: z.array(z.unknown()) }).parse(await res.json())
  const stations = body.stations.flatMap((s) => {
    const r = Station.safeParse(s)
    return r.success ? [r.data] : []
  })
  if (!stations.length) throw new Error('Fuel prices listed no stations')
  return stations
}
