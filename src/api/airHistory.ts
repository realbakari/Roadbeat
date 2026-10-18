import { brisbaneDate } from '../lib/aest'

// Hourly history for one air quality station, from the Department of
// Environment, Tourism, Science and Innovation's Air Quality Query API
// (data.qld.gov.au "Air Quality Monitoring Data API", CC BY 4.0). The API is
// read directly: it sends CORS headers and needs no key. This is the data
// behind the department's own chart page (apps.des.qld.gov.au/air-quality/chart/).

export const AIR_API_URL = 'https://airquality.des.qld.gov.au/v1'
export const AIR_API_DATASET = 'https://www.data.qld.gov.au/dataset/qld-air-quality-api'

export type AirTimeframe = 'day' | 'week' | 'month'
export const AIR_TIMEFRAMES: Record<AirTimeframe, { label: string; hours: number }> = {
  day: { label: '24 hours', hours: 24 },
  week: { label: '7 days', hours: 24 * 7 },
  month: { label: '30 days', hours: 24 * 30 },
}

export interface AirParameter {
  id: number
  name: string
  abbreviation: string
  units: string
  /** The department's guideline for an hourly reading, in `units`, or null when it publishes none. */
  hourStandard: number | null
  /** Its guideline on the averaging period it assesses, as labelled ("µg/m³ (24hr avg)"), or null when none. */
  standard: { value: number; label: string } | null
  /** 1 air quality, 2 meteorological, 5 smoke sensors, as the API numbers them. */
  category: number
  /** The department's page about the pollutant, when it gives one. */
  link: string | null
}

export interface AirReading {
  /** The hour the reading is for, ms since the epoch. */
  time: number
  value: number
  /** The department's running average over its assessment period, where it publishes one. */
  runningAvg: number | null
  /** The department's air quality index for the reading, where it publishes one. */
  index: number | null
  validated: boolean
}

interface ApiParameter {
  parameter_id: number
  parameter_name: string
  abbreviation: string
  units: string
  '1hr_standard': number
  standard: number
  standard_units: string
  category_id: number
  link: string
}

interface ApiMeasurement {
  date_measured: string
  mvalue: number | null
  mvalue_running_avg: number | null
  air_quality_index: number | null
  validated: string
}

const positive = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null)

/** A number the API gives, unless it is one of the department's gap markers: -1111 (sensor offline) or -9999 (no data). */
const reading = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n !== -1111 && n !== -9999 ? n : null)

/** The parameters the API lists for a station, air quality and smoke sensors first, then weather. */
export function parseParameters(rows: unknown): AirParameter[] {
  if (!Array.isArray(rows)) return []
  return (rows as ApiParameter[])
    .filter((p) => typeof p.parameter_id === 'number' && typeof p.parameter_name === 'string')
    .map((p) => ({
      id: p.parameter_id,
      name: p.parameter_name,
      abbreviation: p.abbreviation ?? p.parameter_name,
      units: p.units ?? '',
      hourStandard: positive(p['1hr_standard']),
      standard: positive(p.standard) != null ? { value: p.standard, label: p.standard_units || p.units } : null,
      category: p.category_id,
      link: p.link && /^https?:/.test(p.link) ? p.link : null,
    }))
    .sort((a, b) => (a.category === 2 ? 1 : 0) - (b.category === 2 ? 1 : 0) || a.name.localeCompare(b.name))
}

/**
 * Readings in time order. An hour the API gives no row for, or marks offline
 * (-1111) or without data (-9999), is left out: a gap, not a value.
 */
export function parseMeasurements(rows: unknown): AirReading[] {
  if (!Array.isArray(rows)) return []
  return (rows as ApiMeasurement[])
    .flatMap((r) => {
      const time = Date.parse(r.date_measured)
      const value = reading(r.mvalue)
      if (!Number.isFinite(time) || value == null) return []
      return [{ time, value, runningAvg: reading(r.mvalue_running_avg), index: reading(r.air_quality_index), validated: r.validated === 'Y' }]
    })
    .sort((a, b) => a.time - b.time)
}

const HOUR = 3_600_000

/**
 * The hours a chart covers: a timeframe ending at the end of `date` in
 * Queensland time, or at the current hour when `date` is today or later.
 */
export function historyRange(timeframe: AirTimeframe, date: string | null, now: number): { start: number; end: number } {
  const today = brisbaneDate(now)
  const endOfDay = date && date < today ? Date.parse(`${date}T23:59:59+10:00`) : NaN
  const end = Number.isFinite(endOfDay) ? endOfDay : Math.ceil(now / HOUR) * HOUR
  return { start: end - AIR_TIMEFRAMES[timeframe].hours * HOUR, end }
}

/** The department's chart page for the same station, parameter and period. */
export function departmentChartUrl(stationId: string, parameterId: number, timeframe: AirTimeframe, date: string): string {
  const [y, m, d] = date.split('-')
  const q = new URLSearchParams({ station: stationId, parameter: String(parameterId), date: `${Number(d)}/${m}/${y}`, timeframe })
  return `https://apps.des.qld.gov.au/air-quality/chart/?${q}`
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${AIR_API_URL}${path}`, { signal })
  if (!res.ok) throw new Error(`The air quality API responded with ${res.status}`)
  return res.json()
}

export async function fetchAirParameters(stationId: string, signal?: AbortSignal): Promise<AirParameter[]> {
  return parseParameters(await getJson(`/stations/${encodeURIComponent(stationId)}/parameters?pagesize=10000`, signal))
}

export async function fetchAirReadings(stationId: string, parameterId: number, range: { start: number; end: number }, signal?: AbortSignal): Promise<AirReading[]> {
  const q = new URLSearchParams({ start_date: new Date(range.start).toISOString(), end_date: new Date(range.end).toISOString(), pagesize: '10000' })
  return parseMeasurements(await getJson(`/stations/${encodeURIComponent(stationId)}/parameters/${parameterId}/measurements?${q}`, signal))
}
