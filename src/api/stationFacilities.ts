import { z } from 'zod'

// Queensland Rail station facilities and access, published by Brisbane City
// Council (data.brisbane.qld.gov.au "Railway station facilities", CC BY 4.0).
// Each station lists its GTFS stop ids, so a stop page can look itself up.
// The council's API sends CORS headers, so the browser reads it directly.

export const STATION_FACILITIES_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/railway-station-facilities/information/'
const API = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/railway-station-facilities/records'
const QR = 'https://www.queenslandrail.com.au'

const text = z.string().nullish().transform((s) => (s && s.trim() ? s.trim() : null))
const Record_ = z
  .object({
    title: z.string(),
    al: text,
    sub: text,
    stdet: text,
    ln: z.array(z.string()).nullish(),
    ohours: text,
    cbay: text,
    stops: z.array(z.string()).nullish(),
    zn: text,
    sginfor: text,
    audiofile: text,
    pdffile: text,
    texttranscriptstring: text,
  })
  .catchall(z.unknown())

/** Facility flags, in the order the app lists them. Keys are the dataset's field names without "facility_". */
export const ACCESS_FEATURES = [
  ['lift', 'Lift'],
  ['escalator', 'Escalator'],
  ['level_boarding_to_vehicle', 'Level boarding'],
  ['boarding_ramp_available', 'Boarding ramp available'],
  ['assisted_boarding_point', 'Assisted boarding point'],
  ['accessible_ramp', 'Accessible ramp'],
  ['accessible_parking', 'Accessible parking'],
  ['accessible_kiss_n_ride', "Accessible kiss 'n' ride"],
  ['accessible_toilet_lh', 'Accessible toilet'],
  ['accessible_toilet_rh', 'Accessible toilet'],
  ['accessible_adult_change_facilities', 'Adult change facilities'],
  ['hearing_loop_available', 'Hearing loop'],
  ['tactile_ground_surface_indicators_platform_edges', 'Tactile platform edges'],
  ['help_phone', 'Help phone'],
  ['assistance_animal_relief_area', 'Assistance animal relief area'],
] as const

export const OTHER_FEATURES = [
  ['carpark', 'Car park'],
  ['kiss_n_ride', "Kiss 'n' ride"],
  ['taxi_bay', 'Taxi bay'],
  ['bus_interchange', 'Bus interchange'],
  ['bike_enclosure', 'Bike enclosure'],
  ['secure_bike_storage', 'Secure bike storage'],
  ['toilets', 'Toilets'],
  ['baby_change', 'Baby change'],
  ['drinking_fountain', 'Drinking fountain'],
  ['customer_service_window', 'Customer service window'],
  ['ticket_vending_machine', 'Ticket machine'],
  ['fare_gates', 'Fare gates'],
] as const

export interface Feature {
  /** The dataset's field name without "facility_", e.g. "hearing_loop_available". */
  key: string
  label: string
}

export interface StationFacilities {
  name: string
  address: string | null
  lines: string[]
  /** Queensland Rail's notice for the station, such as lift works (light Markdown). */
  notice: string | null
  /** Staffed hours (light Markdown list). */
  hours: string | null
  carBays: number | null
  /** Queensland Rail's access zone, e.g. "Zone 1 - Independent Access". */
  accessZone: string | null
  /** Platform height and boarding notes (light Markdown list). */
  boarding: string | null
  /** Access features the station has, by dataset key, without repeated labels. */
  access: Feature[]
  /** Other facilities the station has. */
  other: Feature[]
  bikeRacks: number
  audio: string | null
  guide: string | null
  description: string | null
}

const absolute = (href: string | null) => (href ? new URL(href, QR).href : null)

/** Turns one dataset record into the app's shape, or null if it doesn't match the schema. */
export function parseStationFacilities(raw: unknown): StationFacilities | null {
  const r = Record_.safeParse(raw)
  if (!r.success) return null
  const d = r.data
  const has = (key: string) => d[`facility_${key}`] === true
  const access: Feature[] = []
  for (const [key, label] of ACCESS_FEATURES) if (has(key) && !access.some((a) => a.label === label)) access.push({ key, label })
  const bays = d.cbay != null ? Number(d.cbay) : NaN
  const racks = Number(d.facility_bike_rack)
  return {
    name: d.title,
    address: [d.al, d.sub].filter(Boolean).join(', ') || null,
    lines: d.ln ?? [],
    notice: d.stdet,
    hours: d.ohours,
    carBays: Number.isFinite(bays) && bays > 0 ? bays : null,
    accessZone: d.zn,
    boarding: d.sginfor,
    access,
    other: OTHER_FEATURES.filter(([k]) => has(k)).map(([key, label]) => ({ key, label })),
    bikeRacks: Number.isFinite(racks) ? racks : 0,
    audio: absolute(d.audiofile),
    guide: absolute(d.pdffile),
    description: d.texttranscriptstring,
  }
}

const cache = new Map<string, Promise<StationFacilities | null>>()

/** Facilities for the station that lists `stopId` (a station or platform id), or null for stops not in the dataset. */
export function fetchStationFacilities(stopId: string): Promise<StationFacilities | null> {
  let hit = cache.get(stopId)
  if (!hit) {
    const where = `stops="${stopId.replace(/"/g, '')}"`
    hit = fetch(`${API}?limit=1&where=${encodeURIComponent(where)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Brisbane City Council responded with ${res.status}`))))
      .then((body: unknown) => {
        const results = z.object({ results: z.array(z.unknown()) }).parse(body).results
        return results.length ? parseStationFacilities(results[0]) : null
      })
    hit.catch(() => cache.delete(stopId))
    cache.set(stopId, hit)
  }
  return hit
}
