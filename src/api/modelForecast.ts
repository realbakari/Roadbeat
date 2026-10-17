import type { LngLat } from '../lib/geo'

// A raw computer model forecast for one point: Germany's DWD ICON model, served
// by Open-Meteo (CC BY 4.0, free for non-commercial sites without ads or
// subscriptions). It is model output, not a Bureau of Meteorology forecast or
// warning, and every view of it says so, with the model run's time. It's read
// only when a locality page asks for it, so the free tier's limits hold.

export const OPEN_METEO_PAGE = 'https://open-meteo.com/'
export const DWD_ICON_PAGE = 'https://www.dwd.de/EN/research/weatherforecasting/num_modelling/01_num_weather_prediction_modells/icon_description.html'
export const BOM_FORECASTS = 'https://www.bom.gov.au/qld/forecasts/'
const API = 'https://api.open-meteo.com'

export interface ForecastHour {
  /** The hour, ms since the epoch. */
  time: number
  rainMm: number | null
  windKmh: number | null
  gustKmh: number | null
  tempC: number | null
}

export interface ModelForecast {
  /** The model's grid point, which can sit a few kilometres from the place asked for. */
  gridPoint: LngLat
  /** When the model run started, ms since the epoch (from Open-Meteo's model metadata), or null if unknown. */
  runAt: number | null
  hours: ForecastHour[]
}

interface ForecastJson {
  latitude?: number
  longitude?: number
  utc_offset_seconds?: number
  hourly?: { time?: string[]; precipitation?: (number | null)[]; wind_speed_10m?: (number | null)[]; wind_gusts_10m?: (number | null)[]; temperature_2m?: (number | null)[] }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Open-Meteo's hourly arrays, keyed to real instants using its stated UTC offset. */
export function parseForecast(json: unknown, runAt: number | null): ModelForecast | null {
  const j = json as ForecastJson | null
  const h = j?.hourly
  if (!h?.time?.length || num(j?.latitude) == null || num(j?.longitude) == null) return null
  const offset = (j!.utc_offset_seconds ?? 0) * 1000
  const hours = h.time.flatMap((t, i) => {
    const local = Date.parse(`${t}:00Z`)
    if (!Number.isFinite(local)) return []
    return [{ time: local - offset, rainMm: num(h.precipitation?.[i]), windKmh: num(h.wind_speed_10m?.[i]), gustKmh: num(h.wind_gusts_10m?.[i]), tempC: num(h.temperature_2m?.[i]) }]
  })
  return { gridPoint: [j!.longitude!, j!.latitude!], runAt, hours }
}

/** The hours from the current hour on, at most `count`. */
export function upcoming(f: ModelForecast, now: number, count: number): ForecastHour[] {
  const from = Math.floor(now / 3_600_000) * 3_600_000
  return f.hours.filter((h) => h.time >= from).slice(0, count)
}

export async function fetchModelForecast([lng, lat]: LngLat, signal?: AbortSignal): Promise<ModelForecast | null> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    hourly: 'precipitation,wind_speed_10m,wind_gusts_10m,temperature_2m',
    models: 'icon_seamless',
    forecast_days: '2',
    timezone: 'Australia/Brisbane',
  })
  const [res, meta] = await Promise.all([
    fetch(`${API}/v1/forecast?${q}`, { signal }),
    fetch(`${API}/data/dwd_icon/static/meta.json`, { signal }).then(
      (r) => (r.ok ? r.json() : null),
      () => null,
    ),
  ])
  if (!res.ok) throw new Error(`Open-Meteo responded with ${res.status}`)
  const init = num((meta as { last_run_initialisation_time?: unknown } | null)?.last_run_initialisation_time)
  return parseForecast(await res.json(), init != null ? init * 1000 : null)
}
