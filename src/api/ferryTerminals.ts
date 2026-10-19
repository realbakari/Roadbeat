import { z } from 'zod'
import { BCC_DATASETS, bccJson } from './bccOpenData'
import type { Feature } from './stationFacilities'

// Brisbane City Council's ferry terminals, with each terminal's access features
// (data.brisbane.qld.gov.au "Ferry terminals", CC BY 4.0). The `hastus` field is
// Translink's stop id, so a ferry stop page can look itself up. CORS is open.

export const FERRY_TERMINALS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/ferry-terminals/information/'
/** The records endpoint, for a status check. */
export const FERRY_TERMINALS_API = `${BCC_DATASETS}/ferry-terminals/records`

const text = z.string().nullish().transform((s) => (s && s.trim() ? s.trim() : null))
const yes = z.string().nullish().transform((s) => s?.trim().toLowerCase() === 'yes')
const Row = z.object({
  hastus: z.union([z.string(), z.number()]),
  description: z.string(),
  streetname: text,
  suburb: text,
  status: text,
  service_type: text,
  boarding_gates: z.number().nullish(),
  dda_compliant: yes,
  gangway_level_landing: yes,
  tgsi_present: yes,
  braille_signage_present: yes,
  seat_present: yes,
  emergency_call_point: yes,
  cctv: yes,
  lift_access: yes,
  drinking_fountain_present: yes,
  bike_rack: yes,
  parking: yes,
  accessible_parking: yes,
  accessible_loading_zone: yes,
  toilet: yes,
  accessibility: text,
  access_notes: text,
  accessible_toilet: text,
  ticketing: text,
  last_inspection_date: text,
})

export interface FerryTerminal {
  name: string
  address: string | null
  /** "CityCat", "Cross river ferry"… as published. */
  service: string | null
  /** "ACTIVE" unless the council says otherwise. */
  status: string | null
  /** The council's access summary, e.g. "Disabled Access · Wheelchair Access". */
  accessSummary: string | null
  access: Feature[]
  other: Feature[]
  /** Toilet notes, e.g. "Toilet available on CityCat ferries". */
  toiletNote: string | null
  ticketing: string | null
  /** When the council last inspected the terminal (YYYY-MM-DD). */
  inspected: string | null
}

export function parseFerryTerminal(raw: unknown): FerryTerminal | null {
  const r = Row.safeParse(raw)
  if (!r.success) return null
  const d = r.data
  const pick = (list: [boolean, string, string][]) => list.filter(([on]) => on).map(([, key, label]) => ({ key, label }))
  return {
    name: d.description,
    address: [d.streetname, d.suburb].filter(Boolean).join(', ') || null,
    service: d.service_type,
    status: d.status,
    accessSummary: [d.accessibility, d.access_notes].filter(Boolean).join(' · ') || null,
    access: pick([
      [d.dda_compliant, 'dda_compliant', 'Accessible terminal (DDA compliant)'],
      [d.gangway_level_landing, 'gangway_level_landing', 'Level landing at the gangway'],
      [d.lift_access, 'lift', 'Lift'],
      [d.tgsi_present, 'tactile_ground_surface_indicators_platform_edges', 'Tactile ground indicators'],
      [d.braille_signage_present, 'braille_signage', 'Braille signage'],
      [d.accessible_parking, 'accessible_parking', 'Accessible parking'],
      [d.accessible_loading_zone, 'accessible_kiss_n_ride', 'Accessible loading zone'],
      [d.emergency_call_point, 'help_phone', 'Emergency call point'],
    ]),
    other: pick([
      [d.seat_present, 'seating', 'Seating'],
      [d.toilet, 'toilets', 'Toilet'],
      [d.drinking_fountain_present, 'drinking_fountain', 'Drinking fountain'],
      [d.bike_rack, 'bike_rack', 'Bike rack'],
      [d.parking, 'carpark', 'Parking'],
      [d.cctv, 'cctv', 'CCTV'],
    ]),
    toiletNote: d.toilet ? null : d.accessible_toilet,
    ticketing: d.ticketing,
    inspected: d.last_inspection_date?.slice(0, 10) ?? null,
  }
}

const cache = new Map<string, Promise<FerryTerminal | null>>()

/** The ferry terminal for a Translink stop id, or null when the stop isn't one of the council's terminals. */
export function fetchFerryTerminal(stopId: string): Promise<FerryTerminal | null> {
  if (!/^\d+$/.test(stopId)) return Promise.resolve(null)
  let hit = cache.get(stopId)
  if (!hit) {
    hit = bccJson(`ferry-terminals/records?limit=1&where=${encodeURIComponent(`hastus="${stopId}"`)}`).then((body: unknown) => {
      const results = z.object({ results: z.array(z.unknown()) }).parse(body).results
      return results.length ? parseFerryTerminal(results[0]) : null
    })
    hit.catch(() => cache.delete(stopId))
    cache.set(stopId, hit)
  }
  return hit
}
