import { decodeEntities } from '../lib/newsText'

// The Department of Environment, Tourism, Science and Innovation's hourly air
// quality values, each a running average over its own period (data.qld.gov.au
// "Air Quality Monitoring - Live data feed", CC BY 4.0). The feed is XML and sends no CORS headers, so the app reads it
// through /air-quality. Each station lists its measurements with the
// department's own index, rating (1 to 5) and rating name.

export const AIR_QUALITY_URL: string = import.meta.env.VITE_AIR_QUALITY_URL ?? '/air-quality'
export const AIR_QUALITY_DATASET = 'https://www.data.qld.gov.au/dataset/air-quality-monitoring-live-data-feed'

/**
 * Units per measurement, from the department's Air Quality Query API
 * (airquality.des.qld.gov.au/v1/parameters, CC BY 4.0); the live feed gives none.
 */
const UNITS: Record<string, string> = {
  'Carbon monoxide': 'ppm',
  'Nitrogen dioxide': 'ppm',
  Ozone: 'ppm',
  'Sulfur dioxide': 'ppm',
  'Particle PM10': 'µg/m³',
  'Particle PM2.5': 'µg/m³',
  'Particles TSP': 'µg/m³',
  Visibility: 'Mm⁻¹',
}

/**
 * The period each feed value is averaged over, from the same API's
 * `standard_units` (checked 17 October 2026). The feed's value is the running
 * average the department rates against its standard, not the hour's own
 * reading: West Mackay's PM2.5 of 8.4 at 11 pm on 16 October was the API's
 * 24-hour running average, while the hour itself read 7.6.
 */
const AVERAGING: Record<string, string> = {
  'Carbon monoxide': '8-hour average',
  'Nitrogen dioxide': '1-hour average',
  Ozone: '8-hour average',
  'Sulfur dioxide': '1-hour average',
  'Particle PM10': '24-hour average',
  'Particle PM2.5': '24-hour average',
  'Particles TSP': '24-hour average',
  Visibility: '1-hour average',
}

/** The department's five ratings, by its numeric rating. */
export const AIR_RATINGS = ['Very good', 'Good', 'Fair', 'Poor', 'Very poor'] as const
export type AirRating = 1 | 2 | 3 | 4 | 5

/** Roadbeat's colour for each rating (green to dark red), and grey for a station with no rated reading. */
export const AIR_COLOR: Record<AirRating | 0, string> = { 0: '#9ca3af', 1: '#15803d', 2: '#65a30d', 3: '#d97706', 4: '#dc2626', 5: '#7f1d1d' }

/**
 * Text classes for a rating's name, in the same hues as AIR_COLOR but shaded
 * to keep at least 4.5:1 on light and dark surfaces. The marker colours are
 * too light for text in light mode, or too dark in dark mode.
 */
export const AIR_TEXT: Record<AirRating, string> = {
  1: 'text-green-800 dark:text-green-400',
  2: 'text-lime-800 dark:text-lime-400',
  3: 'text-amber-800 dark:text-amber-400',
  4: 'text-red-700 dark:text-red-400',
  5: 'text-red-900 dark:text-red-300',
}

export interface AirMeasurement {
  name: string
  units: string | null
  /** The period the value is averaged over, such as "24-hour average", or null for a measurement the API does not list. */
  averaging: string | null
  /** The value, or null when the feed marks the sensor offline (-1111) or without data (-9999). */
  value: number | null
  /** Why the value is null: as the feed marks it. */
  gap: 'offline' | 'no data' | null
  /** The department's index and rating for the reading, or null when it gives none. */
  index: number | null
  rating: AirRating | null
  ratingName: string | null
}

export interface AirStation {
  /** The station code in the department's own page link, such as "ayr1". */
  id: string
  name: string
  region: string
  /** The department's page for the station. */
  link: string
  position: [number, number]
  /**
   * The hour the feed dates its values to (Queensland time). Each value is an
   * average over the period in its `averaging`, ending at this hour.
   */
  measuredAt: number
  measurements: AirMeasurement[]
}

const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, decodeEntities(v)]))

function number(s: string | undefined): number | null {
  const n = Number(s)
  return s != null && s !== '' && Number.isFinite(n) ? n : null
}

function stationId(link: string): string | null {
  return /[?&]station=([^&#]+)/.exec(link)?.[1] ?? null
}

/** The feed's date and hour, which are Queensland time (AEST, no daylight saving). */
function measuredAt(date: string | undefined, hour: string | undefined): number | null {
  const t = date && hour != null ? Date.parse(`${date}T${hour.padStart(2, '0')}:00:00+10:00`) : NaN
  return Number.isFinite(t) ? t : null
}

function measurement(tag: string, raw: string): AirMeasurement | null {
  const a = attrs(tag)
  const name = a.name
  if (!name) return null
  const value = number(raw.trim())
  const gap = value === -1111 ? 'offline' : value === -9999 ? 'no data' : null
  const rating = number(a.rating)
  const ok = gap === null && rating != null && rating >= 1 && rating <= 5
  return {
    name,
    units: UNITS[name] ?? null,
    averaging: AVERAGING[name] ?? null,
    value: gap ? null : value,
    gap,
    index: ok ? number(a.index) : null,
    rating: ok ? (rating as AirRating) : null,
    ratingName: ok ? (a.rating_name ?? null) : null,
  }
}

/**
 * Stations and their latest readings from the live feed. A station without a
 * code, a position or a measured hour is dropped; a measurement the feed marks
 * offline or without data is kept with a null value, so the page can say so.
 */
export function parseAirQuality(xml: string): AirStation[] {
  const out: AirStation[] = []
  for (const [, regionTag, regionBody] of xml.matchAll(/<region\b([^>]*)>([\s\S]*?)<\/region>/g)) {
    const region = attrs(regionTag).name ?? ''
    for (const [, stationTag, body] of regionBody.matchAll(/<station\b([^>]*)>([\s\S]*?)<\/station>/g)) {
      const a = attrs(stationTag)
      const id = a.information ? stationId(a.information) : null
      const lng = number(a.longitude)
      const lat = number(a.latitude)
      const at = measuredAt(a.measurementdate, a.measurementhour)
      if (!id || !a.name || lng == null || lat == null || at == null) continue
      const measurements = [...body.matchAll(/<measurement\b([^>]*)>([^<]*)<\/measurement>/g)].flatMap(([, tag, raw]) => measurement(tag, raw) ?? [])
      out.push({ id, name: a.name, region, link: a.information, position: [lng, lat], measuredAt: at, measurements })
    }
  }
  return out
}

/** The worst (highest) rating among a station's rated measurements, or null when none is rated. */
export function worstRating(s: AirStation): AirRating | null {
  const rated = s.measurements.flatMap((m) => (m.rating ? [m.rating] : []))
  return rated.length ? (Math.max(...rated) as AirRating) : null
}

export async function fetchAirQuality(signal?: AbortSignal): Promise<AirStation[]> {
  const res = await fetch(AIR_QUALITY_URL, { signal })
  if (!res.ok) throw new Error(`The air quality feed responded with ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Air quality feed proxy is not configured')
  return parseAirQuality(await res.text())
}
