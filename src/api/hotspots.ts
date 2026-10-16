import { z } from 'zod'
import type { LngLat } from '../lib/geo'

// Satellite hotspots from Geoscience Australia's Digital Earth Australia (DEA)
// Hotspots service: places where a satellite sensor measured unusual heat.
// It gathers detections from NASA, NOAA, Japan's Himawari-9 and others. The
// WFS answers CORS requests, so the app reads it directly, asking only for
// Queensland's detections in the last 24 hours (about 11,000 points, ~240 KB
// compressed). © Commonwealth of Australia (Geoscience Australia), CC BY 4.0.

export const HOTSPOTS_PORTAL = 'https://hotspots.dea.ga.gov.au/'
export const HOTSPOTS_ATTRIBUTION = '© Commonwealth of Australia (Geoscience Australia)'
/** How far back the layer asks for, in hours. */
export const HOTSPOT_HOURS = 24

const FIELDS = ['id', 'satellite', 'sensor', 'product', 'datetime', 'latitude', 'longitude', 'confidence', 'temp_kelvin', 'accuracy']

export const HOTSPOTS_URL =
  'https://hotspots.dea.ga.gov.au/geoserver/public/wfs?' +
  new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: 'public:hotspots_three_days',
    outputFormat: 'application/json',
    propertyName: FIELDS.join(','),
    CQL_FILTER: `australian_state='QLD' AND hours_since_hotspot<${HOTSPOT_HOURS}`,
  })

/** One detection, as Geoscience Australia publishes it. */
export interface Hotspot {
  id: string
  position: LngLat
  /** When the satellite observed it, ms since the epoch. */
  observedAt: number
  /** The satellite, e.g. "NOAA 21" or "HIMAWARI-9". */
  satellite: string
  /** Its sensor, e.g. "VIIRS", "MODIS" or "AHI". */
  sensor: string
  /** The detection algorithm that produced it, e.g. "AFIMG" or "BRIGHT AHI". */
  product: string
  /** The algorithm's confidence score, 0 to 100, or null when none is given. */
  confidence: number | null
  /** The temperature the sensor measured at the point, in kelvin, or null. */
  kelvin: number | null
  /** The published position accuracy, e.g. "± 2km", or null. */
  accuracy: string | null
}

const num = z.number().finite().nullish()
const text = z.string().nullish().transform((s) => (s && s.trim() ? s.trim() : null))

const Props = z.object({
  id: z.union([z.number(), z.string()]),
  satellite: text,
  sensor: text,
  product: text,
  datetime: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  confidence: num,
  temp_kelvin: num,
  accuracy: text,
})

function toHotspot(raw: unknown): Hotspot | null {
  const p = Props.safeParse((raw as { properties?: unknown } | null)?.properties)
  if (!p.success) return null
  const d = p.data
  // The service writes UTC; a time without a zone would be read as local, so it's rejected.
  const observedAt = /(Z|[+-]\d\d:?\d\d)$/.test(d.datetime) ? Date.parse(d.datetime) : NaN
  if (!Number.isFinite(observedAt) || !d.satellite) return null
  return {
    id: String(d.id),
    position: [d.longitude, d.latitude],
    observedAt,
    satellite: d.satellite,
    sensor: d.sensor ?? '',
    product: d.product ?? '',
    confidence: d.confidence ?? null,
    kelvin: d.temp_kelvin ?? null,
    accuracy: d.accuracy,
  }
}

/** Every usable detection in a WFS GeoJSON reply, newest first; [] for anything else. */
export function parseHotspots(json: unknown): Hotspot[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  return features.flatMap((f) => toHotspot(f) ?? []).sort((a, b) => b.observedAt - a.observedAt)
}

/** The layer's own colour, for its switch and map card. */
export const HOTSPOT_COLOR = '#ea580c'

/** Age bands the map colours hotspots by, as the hours since the satellite observed them. */
export const HOTSPOT_AGES = [
  { hours: 1, label: 'Under 1 hour', color: '#dc2626' },
  { hours: 6, label: '1 to 6 hours', color: '#ea580c' },
  { hours: 24, label: '6 to 24 hours', color: '#ca8a04' },
] as const

/** The age band index (0, 1 or 2) for a detection, from the time it was observed. */
export function hotspotAge(h: Hotspot, now: number): 0 | 1 | 2 {
  const hours = (now - h.observedAt) / 3_600_000
  return hours < HOTSPOT_AGES[0].hours ? 0 : hours < HOTSPOT_AGES[1].hours ? 1 : 2
}

export async function fetchHotspots(signal?: AbortSignal): Promise<Hotspot[]> {
  const res = await fetch(HOTSPOTS_URL, { signal })
  if (!res.ok) throw new Error(`DEA Hotspots responded with ${res.status}`)
  return parseHotspots(await res.json())
}
