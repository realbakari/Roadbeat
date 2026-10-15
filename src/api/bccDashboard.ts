import { z } from 'zod'

// Brisbane City Council datasets for the dashboard (data.brisbane.qld.gov.au,
// CC BY 4.0): key corridor monthly performance, council events and pedestrian
// movement counts. The council's API sends CORS headers, so the browser reads
// them directly.

const BASE = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets'
export const CORRIDORS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/traffic-management-key-corridor-monthly-performance-report/information/'
export const EVENTS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/brisbane-city-council-events/information/'
export const PEDESTRIANS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/pedestrian-movement-counts/information/'

/** Every row matching `params`, from the dataset's JSON export (no 100-row page limit). */
async function rows(dataset: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown[]> {
  const res = await fetch(`${BASE}/${dataset}/exports/json?${new URLSearchParams(params)}`, { signal })
  if (!res.ok) throw new Error(`Brisbane City Council responded with ${res.status}`)
  return z.array(z.unknown()).parse(await res.json())
}

const parse = <T>(list: unknown[], schema: z.ZodType<T>): T[] => list.flatMap((r) => {
  const p = schema.safeParse(r)
  return p.success ? [p.data] : []
})

// Key corridors

export interface CorridorMonth {
  siteId: number
  year: number
  month: number
  /** Average weekday traffic, vehicles per day. */
  dailyVehicles: number | null
  amSeconds: number | null
  pmSeconds: number | null
  amKmh: number | null
  pmKmh: number | null
}

const num = z.union([z.string(), z.number()]).nullish().transform((v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)))
const CorridorRow = z
  .object({
    site_id: z.number(),
    year: z.union([z.string(), z.number()]),
    month: z.number(),
    avg_weekday_daily_traffic_veh_day: num,
    travel_time_am_peak_7_9am_seconds: num,
    travel_time_pm_peak_4_7pm_seconds: num,
    speed_am_peak_7_9am_km_hr: num,
    speed_pm_peak_4_7pm_km_hr: num,
  })
  .transform(
    (r): CorridorMonth => ({
      siteId: r.site_id,
      year: Number(r.year),
      month: r.month,
      dailyVehicles: r.avg_weekday_daily_traffic_veh_day,
      amSeconds: r.travel_time_am_peak_7_9am_seconds,
      pmSeconds: r.travel_time_pm_peak_4_7pm_seconds,
      amKmh: r.speed_am_peak_7_9am_km_hr,
      pmKmh: r.speed_pm_peak_4_7pm_km_hr,
    }),
  )
const RouteRow = z.object({ site_id: z.number(), site: z.string(), distance: num, start_intersection: z.string().nullish(), end_intersection: z.string().nullish() })

export interface Corridor {
  siteId: number
  name: string
  km: number | null
  from: string | null
  to: string | null
}

/** The corridors and the last two to three years of monthly results, enough to compare the latest month with a year earlier. */
export async function fetchCorridors(now: number, signal?: AbortSignal): Promise<{ corridors: Corridor[]; months: CorridorMonth[] }> {
  const year = new Date(now).getUTCFullYear()
  // `year` is text in this dataset, which the council's API can't compare with >=, so list the years.
  const years = [year - 2, year - 1, year].map((y) => `"${y}"`).join(',')
  const [routes, months] = await Promise.all([
    rows('traffic-management-key-corridor-monthly-performance-report-routes', {}, signal),
    rows('traffic-management-key-corridor-monthly-performance-report', { where: `year in (${years})` }, signal),
  ])
  return {
    corridors: parse(routes, RouteRow).map((r) => ({ siteId: r.site_id, name: r.site, km: r.distance, from: r.start_intersection ?? null, to: r.end_intersection ?? null })),
    months: parse(months, CorridorRow),
  }
}

// Council events

export interface CouncilEvent {
  title: string
  venue: string | null
  start: number
  end: number | null
  /** The council's own wording of the date and time, e.g. "Friday, 6 November 2026, 4:30 - 10pm". */
  when: string | null
  url: string | null
  types: string[]
}

const EventRow = z
  .object({
    subject: z.string(),
    venue: z.string().nullish(),
    location: z.string().nullish(),
    start_datetime: z.string(),
    end_datetime: z.string().nullish(),
    formatteddatetime: z.string().nullish(),
    web_link: z.string().nullish(),
    event_type: z.array(z.string()).nullish(),
  })
  .transform(
    (r): CouncilEvent => ({
      title: r.subject.trim(),
      venue: r.venue?.trim() || r.location?.trim() || null,
      start: Date.parse(r.start_datetime),
      end: r.end_datetime ? Date.parse(r.end_datetime) : null,
      when: r.formatteddatetime?.trim() || null,
      url: r.web_link || null,
      types: r.event_type ?? [],
    }),
  )

/** Council events starting between `from` and `to` (ms), soonest first. */
export async function fetchCouncilEvents(from: number, to: number, signal?: AbortSignal): Promise<CouncilEvent[]> {
  const iso = (t: number) => new Date(t).toISOString().slice(0, 19)
  const list = await rows('brisbane-city-council-events', { where: `start_datetime >= '${iso(from)}' and start_datetime < '${iso(to)}'`, order_by: 'start_datetime' }, signal)
  return parse(list, EventRow)
}

// Pedestrian movements

export interface PedestrianHour {
  sensor: string
  precinct: string | null
  /** Movements counted in the hour. Null when fewer than 25, which the council publishes only as "< 25". */
  count: number | null
  /** True for hours the council estimated because a sensor or network failed. */
  estimated: boolean
}

const PedRow = z
  .object({ sensor_location: z.string(), location: z.string().nullish(), count: z.number().nullish(), prefix: z.string().nullish(), is_computed: z.union([z.string(), z.number()]).nullish() })
  .transform(
    (r): PedestrianHour => ({
      sensor: r.sensor_location.trim(),
      precinct: r.location?.trim() || null,
      count: r.prefix?.includes('<') ? null : (r.count ?? null),
      estimated: String(r.is_computed) === '1',
    }),
  )

/** Every hourly count for one day (YYYY-MM-DD, Brisbane). */
export async function fetchPedestrianDay(date: string, signal?: AbortSignal): Promise<PedestrianHour[]> {
  return parse(await rows('pedestrian-movement-counts', { where: `date = date'${date}'` }, signal), PedRow)
}
