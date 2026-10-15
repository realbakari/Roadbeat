import { z } from 'zod'

// Brisbane City Council map layers for getting around (data.brisbane.qld.gov.au,
// CC BY 4.0): clearways, public toilets and accessible parking. Each is a small
// export the browser reads directly (the council's API sends CORS headers).

const BASE = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets'
export const CLEARWAYS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/parking-clearways/information/'
export const TOILETS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/public-toilets-in-brisbane/information/'
export const ACCESSIBLE_PARKING_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/disability-permit-parking-locations/information/'

const text = z.string().nullish().transform((s) => (s && s.trim() && s.trim().toLowerCase() !== 'null' ? s.trim() : null))
const flag = z.union([z.string(), z.boolean()]).nullish().transform((v) => v === true || v === 'True' || v === 'true')
type LngLat = [number, number]

async function exportJson(dataset: string, signal?: AbortSignal): Promise<unknown[]> {
  const res = await fetch(`${BASE}/${dataset}/exports/json`, { signal })
  if (!res.ok) throw new Error(`Brisbane City Council responded with ${res.status}`)
  return z.array(z.unknown()).parse(await res.json())
}

/** Parses each row with `schema`, skipping rows that don't match rather than showing them half-filled. */
function rows<S extends z.ZodType, T>(list: unknown[], schema: S, map: (r: z.infer<S>) => T | null): T[] {
  return list.flatMap((raw) => {
    const r = schema.safeParse(raw)
    if (!r.success) return []
    const v = map(r.data)
    return v == null ? [] : [v]
  })
}

// Clearways

export interface Clearway {
  id: string
  /** Signed times as published, e.g. "7AM-9AM 4PM-7PM MON-FRI"; null when the council has none. */
  times: string | null
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString
}

const Line = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LineString'), coordinates: z.array(z.array(z.number())) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(z.array(z.number()))) }),
])
const ClearwayRow = z.object({ objectid: z.union([z.string(), z.number()]), category: z.string(), operational_time: text, geo_shape: z.object({ geometry: Line }) })

export function parseClearways(list: unknown[]): Clearway[] {
  return rows(list, ClearwayRow, (r) =>
    r.category === 'Clearway' ? { id: String(r.objectid), times: r.operational_time, geometry: r.geo_shape.geometry as Clearway['geometry'] } : null,
  )
}

export const fetchClearways = (signal?: AbortSignal) => exportJson('parking-clearways', signal).then(parseClearways)

// Public toilets

export interface Toilet {
  id: string
  name: string
  address: string | null
  position: LngLat
  /** Opening hours as published, e.g. "OPEN: Mon-Thu 9am-5:30pm". */
  hours: string | null
  accessible: boolean
  ambulant: boolean
  adultChange: boolean
  changingPlaces: boolean
  /** Needs a Master Locksmiths Access Key (MLAK). */
  mlak: boolean
  keyRequired: boolean
  babyChange: boolean
  accessibleParking: boolean
  drinkingWater: boolean
  shower: boolean
  notes: string[]
  /** This facility on the National Public Toilet Map. */
  url: string | null
}

const ToiletRow = z.object({
  facilityid: z.union([z.string(), z.number()]),
  name: z.string(),
  address1: text,
  town: text,
  latitude: z.number(),
  longitude: z.number(),
  openinghours: text,
  openinghoursnote: text,
  accessible: flag,
  ambulant: flag,
  adultchange: flag,
  changingplaces: flag,
  mlak24: flag,
  mlakafterhours: flag,
  acmlak: flag,
  keyrequired: flag,
  babychange: flag,
  parkingaccessible: flag,
  drinkingwater: flag,
  shower: flag,
  accessnote: text,
  toiletnote: text,
  url: text,
})

export function parseToilets(list: unknown[]): Toilet[] {
  return rows(list, ToiletRow, (r) => ({
    id: String(r.facilityid),
    name: r.name.trim(),
    address: [r.address1, r.town].filter(Boolean).join(', ') || null,
    position: [r.longitude, r.latitude],
    hours: [r.openinghours, r.openinghoursnote].filter(Boolean).join(' ') || null,
    accessible: r.accessible,
    ambulant: r.ambulant,
    adultChange: r.adultchange,
    changingPlaces: r.changingplaces,
    mlak: r.mlak24 || r.mlakafterhours || r.acmlak,
    keyRequired: r.keyrequired,
    babyChange: r.babychange,
    accessibleParking: r.parkingaccessible,
    drinkingWater: r.drinkingwater,
    shower: r.shower,
    notes: [r.accessnote, r.toiletnote].filter((n): n is string => !!n),
    url: r.url,
  }))
}

export const fetchToilets = (signal?: AbortSignal) => exportJson('public-toilets-in-brisbane', signal).then(parseToilets)

// Accessible parking

export interface AccessibleBay {
  id: string
  street: string | null
  suburb: string | null
  position: LngLat
  /** Posted days and times, one per sign panel, e.g. ["7 AM-4 PM", "MON-FRI 7:00AM-10:00AM"]. Empty when none is published. */
  times: string[]
}

const BayRow = z.object({
  objectid: z.union([z.string(), z.number()]),
  street: text,
  suburb: text,
  latitude: z.number(),
  longitude: z.number(),
  parkingrestrictiondaysandtimes: text,
  assetlifecycle: text,
})

// Council data is in capitals: "ALICE STREET" → "Alice Street".
const title = (s: string | null) => s && s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** "null:7 AM-4 PM ,MON-FRI:7:00AM-10:00AM" → ["7 AM-4 PM", "MON-FRI 7:00AM-10:00AM"]. "null" means the panel names no days. */
export function bayTimes(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => {
      const [days, ...time] = part.split(':')
      const t = time.join(':').trim()
      const d = days.trim()
      return t ? (d && d.toLowerCase() !== 'null' ? `${d} ${t}` : t) : d.toLowerCase() === 'null' ? '' : d
    })
    .filter(Boolean)
}

export function parseAccessibleBays(list: unknown[]): AccessibleBay[] {
  return rows(list, BayRow, (r) =>
    r.assetlifecycle && r.assetlifecycle !== 'In Service'
      ? null
      : { id: String(r.objectid), street: title(r.street), suburb: title(r.suburb), position: [r.longitude, r.latitude], times: bayTimes(r.parkingrestrictiondaysandtimes) },
  )
}

export const fetchAccessibleBays = (signal?: AbortSignal) => exportJson('disability-permit-parking-locations', signal).then(parseAccessibleBays)

// Parking meters

export const PARKING_METERS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/brisbane-parking-meters/information/'

export interface ParkingMeter {
  id: string
  street: string | null
  suburb: string | null
  /** Where the bays are, e.g. "King St between St Pauls Tce and Gregory Tce in Bowen Hills". */
  where: string | null
  position: LngLat
  /** As published, e.g. "MON-FRI" and "7AM-7PM,7PM-10PM(MON-FRI),7AM-7PM(SAT,SUN)". */
  days: string | null
  hours: string | null
  maxStayHours: number | null
  /** Dollars per hour on weekdays, and after hours and on weekends where the council lists a rate. */
  rate: number | null
  afterHoursRate: number | null
  /** Most a stay can cost, in dollars, where the council lists one. */
  cap: number | null
  /** Tariff zone as published, e.g. "Zone 2, 15 min free". */
  zone: string | null
  bays: number | null
  /** Pay by app only, or a ticketless meter. */
  payment: string | null
  /** The zone number to enter in the parking app. */
  appZone: string | null
  /** Other signs on the street, e.g. "CLEARWAY 4PM-7PM MON-FRI TOWAWAY". */
  restriction: string | null
}

const money = z.union([z.string(), z.number()]).nullish().transform((v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)))
const MeterRow = z.object({
  meter_no: z.union([z.string(), z.number()]),
  category: text,
  street: text,
  suburb: text,
  loc_desc: text,
  latitude: z.number(),
  longitude: z.number(),
  operational_day: text,
  operational_time: text,
  max_stay_hrs: money,
  tar_rate_weekday: money,
  tar_rate_ah_we: money,
  max_cap_chg: money,
  tar_zone: text,
  veh_bays: money,
  mobile_zone: text,
  restrictions: text,
})

const PAYMENT: Record<string, string> = { 'PAY BY MOBILE APP ONLY': 'Pay by app only', 'TICKETLESS METER MULTISPACE': 'Ticketless meter or app', Hybrid: 'Meter or app' }

export function parseParkingMeters(list: unknown[]): ParkingMeter[] {
  return rows(list, MeterRow, (r) => ({
    id: String(r.meter_no),
    street: title(r.street),
    suburb: title(r.suburb),
    where: r.loc_desc,
    position: [r.longitude, r.latitude],
    days: r.operational_day,
    hours: r.operational_time?.replace(/,(?=\S)/g, ', ') ?? null,
    maxStayHours: r.max_stay_hrs,
    rate: r.tar_rate_weekday,
    afterHoursRate: r.tar_rate_ah_we,
    cap: r.max_cap_chg,
    zone: r.tar_zone,
    bays: r.veh_bays,
    payment: r.category ? (PAYMENT[r.category] ?? r.category) : null,
    appZone: r.mobile_zone,
    restriction: r.restrictions && r.restrictions.toUpperCase() !== 'NONE' ? r.restrictions : null,
  }))
}

export const fetchParkingMeters = (signal?: AbortSignal) => exportJson('brisbane-parking-meters', signal).then(parseParkingMeters)

// Bike racks and repair stations

export const BIKE_RACKS_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/bicycle-racks/information/'

export interface BikeStop {
  id: string
  kind: 'rack' | 'repair'
  /** Address or place, e.g. "101 Edward Street" or "Colmslie Beach Reserve, Murarrie". */
  name: string
  detail: string | null
  suburb: string | null
  position: LngLat
  /** Bikes the rack holds, where published. */
  capacity: number | null
}

const RackRow = z.object({ objectid: z.union([z.string(), z.number()]), address: text, location: text, suburb: text, capacity: money, rack_type: text, latitude: z.number(), longitude: z.number() })
const RepairRow = z.object({ objectid: z.union([z.string(), z.number()]), location: text, suburb: text, latitude: z.number(), longitude: z.number() })

export function parseBikeRacks(list: unknown[]): BikeStop[] {
  return rows(list, RackRow, (r) => ({
    id: `rack-${r.objectid}`,
    kind: 'rack',
    name: r.address ?? r.location ?? 'Bike rack',
    detail: [r.rack_type, r.address ? r.location : null].filter(Boolean).join(' · ') || null,
    suburb: r.suburb,
    position: [r.longitude, r.latitude],
    capacity: r.capacity,
  }))
}

export function parseRepairStations(list: unknown[]): BikeStop[] {
  return rows(list, RepairRow, (r) => ({ id: `repair-${r.objectid}`, kind: 'repair', name: r.location ?? 'Bike repair station', detail: null, suburb: r.suburb, position: [r.longitude, r.latitude], capacity: null }))
}

export const fetchBikeStops = (signal?: AbortSignal) =>
  Promise.all([exportJson('bicycle-racks', signal).then(parseBikeRacks), exportJson('bike-repair-stations', signal).then(parseRepairStations)]).then(([a, b]) => [...b, ...a])
