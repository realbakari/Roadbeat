import { z } from 'zod'
import { bccJson } from './bccOpenData'

// Brisbane City Council's planned temporary road occupancies: permits for lane
// and road closures on council roads (data.brisbane.qld.gov.au "Planned temporary
// road occupancies", CC BY 4.0, updated daily). The permit holder's contact name
// and phone number are left out. CORS is open, so the browser reads it directly.

export const ROAD_OCCUPANCIES_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/planned-temporary-road-occupancies/information/'

export interface RoadOccupancy {
  /** Permit certificate number, unique per occupancy. */
  id: string
  road: string
  from: string | null
  to: string | null
  suburb: string | null
  /** As published: "Full Closure", "1 of 2 Lanes", "Shuttle Flow"… */
  closure: string
  direction: string | null
  work: string | null
  /** As published: "Overnight", "Daily", "Weekends", "Sundays only", "Continuously". */
  period: string
  /** First and last dates, YYYY-MM-DD, Brisbane time. */
  startDate: string
  endDate: string
  /** Daily start and finish, HH:MM. Overnight occupancies finish the next morning. */
  startTime: string | null
  finishTime: string | null
}

const opt = z.string().nullish().transform((s) => (s && s.trim() ? s.trim() : null))
const Row = z.object({
  certificate: z.string(),
  road_primary: z.string(),
  '1st_cross_street': opt,
  '2nd_cross_street': opt,
  suburb: opt,
  closure_type: z.string(),
  direction: opt,
  job_description: opt,
  period: z.string(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: opt,
  finish_time: opt,
})

// Council data is in capitals: "KINGSFORD SMITH DRIVE" → "Kingsford Smith Drive".
const title = (s: string | null) => s && s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bM(c)([a-z])/g, (_, c, l: string) => `M${c}${l.toUpperCase()}`)
const hhmm = (t: string | null) => (t && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null)

/** Turns the export into occupancies. Rows that don't match the schema are skipped. */
export function parseRoadOccupancies(json: unknown): RoadOccupancy[] {
  return z
    .array(z.unknown())
    .parse(json)
    .flatMap((raw) => {
      const r = Row.safeParse(raw)
      if (!r.success) return []
      const d = r.data
      return [
        {
          id: d.certificate,
          road: title(d.road_primary)!,
          from: title(d['1st_cross_street']),
          to: title(d['2nd_cross_street']),
          suburb: title(d.suburb),
          closure: d.closure_type,
          direction: d.direction,
          work: d.job_description,
          period: d.period,
          startDate: d.start_date,
          endDate: d.end_date,
          startTime: hhmm(d.start_time),
          finishTime: hhmm(d.finish_time),
        },
      ]
    })
}

export async function fetchRoadOccupancies(signal?: AbortSignal): Promise<RoadOccupancy[]> {
  return parseRoadOccupancies(await bccJson('planned-temporary-road-occupancies/exports/json', { signal }))
}
