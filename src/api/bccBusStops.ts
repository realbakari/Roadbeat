import { z } from 'zod'

// Brisbane City Council's bus stop audit (data.brisbane.qld.gov.au "Brisbane bus
// stops", CC BY 4.0): each council bus stop's type and the council's access
// ratings. `hastus` is TransLink's stop id, so a stop page can look itself up.
// The council's API sends CORS headers, so the browser reads it directly.

export const BUS_STOPS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/brisbane-bus-stops/information/'
const API = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/brisbane-bus-stops/records'

/** The council's three-step ratings, as published. */
export type Rating = 'Easy' | 'Medium' | 'Hard'

export interface BusStopAudit {
  name: string
  street: string | null
  crossStreet: string | null
  suburb: string | null
  /** Stop type without the council's numbering, e.g. "Regular with seat", "Busway Station". */
  type: string | null
  /** How easy it is to board from the stop, as the council rated it. */
  boarding: Rating | null
  /** The slope of the road along the stop. */
  gradient: Rating | null
  /** The slope of the footpath across the stop. */
  crossFall: Rating | null
  /** Tactile ground surface indicators at the stop. Null when the council records neither Y nor N. */
  tactile: boolean | null
  /** When the council last audited the stop (YYYY-MM-DD), if recorded. */
  audited: string | null
}

const text = z.string().nullish().transform((s) => (s && s.trim() ? s.trim() : null))
const rating = z.string().nullish().transform((s): Rating | null => (s === 'Easy' || s === 'Medium' || s === 'Hard' ? s : null))
const Row = z.object({
  hastus: z.union([z.string(), z.number()]),
  description: z.string(),
  streetname: text,
  nearest_cross_street: text,
  suburb: text,
  bus_stop_type: text,
  boarding_point: rating,
  road_gradient: rating,
  cross_fall: rating,
  tactile_ground_surf_indicat_y_n: text,
  date_of_last_audit: text,
})

// Council data is in capitals: "TARRAGINDI" → "Tarragindi".
const title = (s: string | null) => s && s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

export function parseBusStopAudit(raw: unknown): BusStopAudit | null {
  const r = Row.safeParse(raw)
  if (!r.success) return null
  const d = r.data
  const tactile = d.tactile_ground_surf_indicat_y_n?.toUpperCase()
  return {
    name: d.description,
    street: d.streetname,
    crossStreet: d.nearest_cross_street,
    suburb: title(d.suburb),
    type: d.bus_stop_type?.replace(/^\d+\s*-\s*/, '') ?? null,
    boarding: d.boarding_point,
    gradient: d.road_gradient,
    crossFall: d.cross_fall,
    tactile: tactile === 'Y' ? true : tactile === 'N' ? false : null,
    audited: d.date_of_last_audit?.slice(0, 10) ?? null,
  }
}

const cache = new Map<string, Promise<BusStopAudit | null>>()

/** The council's audit for a TransLink stop id, or null when the stop isn't a council bus stop. */
export function fetchBusStopAudit(stopId: string): Promise<BusStopAudit | null> {
  if (!/^\d+$/.test(stopId)) return Promise.resolve(null)
  let hit = cache.get(stopId)
  if (!hit) {
    hit = fetch(`${API}?limit=1&where=${encodeURIComponent(`hastus="${stopId}"`)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Brisbane City Council responded with ${res.status}`))))
      .then((body: unknown) => {
        const results = z.object({ results: z.array(z.unknown()) }).parse(body).results
        return results.length ? parseBusStopAudit(results[0]) : null
      })
    hit.catch(() => cache.delete(stopId))
    cache.set(stopId, hit)
  }
  return hit
}
