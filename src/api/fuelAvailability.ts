import { z } from 'zod'
import type { LngLat } from '../lib/distance.js'

// Fuel availability at Queensland service stations: the "Fuel Status" layer
// that council disaster dashboards show (Isaac, Townsville, Redlands,
// Goondiwindi and others), built from the Queensland Government's fuel price
// reporting. Roadbeat's server reads it (api/_lib/endpoints/fuel.ts, from the
// address in its FUEL_LAYER_URL setting) and the app reads /api/fuel. Only
// availability is kept: the layer also carries prices, which come from the
// state's Fuel Prices API, whose licence restricts republishing.

export const FUEL_URL = '/api/fuel'

/** The state's list of council disaster dashboards, for stations whose council has none on Roadbeat's list. */
export const DASHBOARDS_PAGE = 'https://www.qld.gov.au/community/disasters-emergencies/disasters/resources-translations/local-government-disaster-dashboards'

/** The fuels the layer lists: its field name, and the name on a bowser, in the order a station page shows them. */
export const FUELS = [
  ['Unleaded_91', 'Unleaded 91'],
  ['E10', 'E10'],
  ['Premium_95', 'Premium 95'],
  ['Premium_98', 'Premium 98'],
  ['Diesel', 'Diesel'],
  ['Premium_Diesel', 'Premium diesel'],
  ['E85', 'E85'],
  ['LPG', 'LPG'],
  ['AdBlue', 'AdBlue'],
  ['JetA1', 'Jet A-1'],
  ['AvGas', 'Avgas'],
] as const

/** Every field the server asks the layer for: availability only, never a price. */
export const FUEL_FIELDS = ['ObjectId', 'Site_Id', 'Service_Station_Name', 'Brand_Name', 'Location', 'Postcode', 'lga_name', 'Outage_Type', 'Information_Last_Updated', ...FUELS.map(([f]) => f)]

export type FuelStatus = 'available' | 'partial' | 'unavailable' | 'unknown'

/** The layer's own words for a station's overall status. */
const STATUS: Record<string, FuelStatus> = {
  'Fuel Available': 'available',
  'Fuel Partially Available': 'partial',
  'Fuel Unavailable': 'unavailable',
  'Fuel Unknown': 'unknown',
}

export const FUEL_STATUS_LABEL: Record<FuelStatus, string> = {
  available: 'Fuel available',
  partial: 'Some fuels unavailable',
  unavailable: 'No fuel available',
  unknown: 'Fuel status unknown',
}

export interface FuelStation {
  /** The state's site id, as a string for links. */
  id: string
  name: string
  brand: string | null
  address: string | null
  postcode: number | null
  /** The local government area the layer names, e.g. "Isaac Regional". */
  council: string | null
  status: FuelStatus
  /** When the layer says the station's information was last updated, or null where it doesn't. */
  updatedAt: number | null
  /** Each fuel the station lists, with whether it's available. Fuels the station doesn't list are left out. */
  fuels: { name: string; available: boolean }[]
  position: LngLat
}

const text = z.string().trim().min(1).nullable().optional().catch(null)
const Feature = z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.record(z.string(), z.unknown()),
})

/** The stations in one page of the layer's GeoJSON; a feature with no point or no site id is left out. */
export function parseFuelStations(json: unknown): { stations: FuelStation[]; more: boolean } {
  const body = json as { features?: unknown[]; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean } } | null
  const stations: FuelStation[] = []
  for (const raw of body?.features ?? []) {
    const f = Feature.safeParse(raw)
    if (!f.success) continue
    const p = f.data.properties
    const id = p.Site_Id
    if (typeof id !== 'number' && typeof id !== 'string') continue
    const updated = typeof p.Information_Last_Updated === 'number' && p.Information_Last_Updated > 0 ? p.Information_Last_Updated : null
    const fuels = FUELS.flatMap(([field, label]) => (p[field] === 'Available' || p[field] === 'Unavailable' ? [{ name: label, available: p[field] === 'Available' }] : []))
    stations.push({
      id: String(id),
      name: text.parse(p.Service_Station_Name) ?? 'Service station',
      brand: text.parse(p.Brand_Name) ?? null,
      address: text.parse(p.Location) ?? null,
      postcode: typeof p.Postcode === 'number' ? p.Postcode : null,
      council: text.parse(p.lga_name) ?? null,
      status: STATUS[String(p.Outage_Type)] ?? 'unknown',
      updatedAt: updated,
      fuels,
      position: f.data.geometry.coordinates,
    })
  }
  return { stations, more: !!(body?.exceededTransferLimit || body?.properties?.exceededTransferLimit) }
}

const Station = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  address: z.string().nullable(),
  postcode: z.number().nullable(),
  council: z.string().nullable(),
  status: z.enum(['available', 'partial', 'unavailable', 'unknown']),
  updatedAt: z.number().nullable(),
  fuels: z.array(z.object({ name: z.string(), available: z.boolean() })),
  position: z.tuple([z.number(), z.number()]),
})

/** Every station, from Roadbeat's /api/fuel. */
export async function fetchFuelStations(signal?: AbortSignal): Promise<FuelStation[]> {
  const res = await fetch(FUEL_URL, { signal })
  if (!res.ok) throw new Error(`Fuel status responded with ${res.status}`)
  const body = z.object({ stations: z.array(z.unknown()) }).parse(await res.json())
  const stations = body.stations.flatMap((s) => {
    const r = Station.safeParse(s)
    return r.success ? [r.data] : []
  })
  if (!stations.length) throw new Error('Fuel status listed no stations')
  return stations
}
