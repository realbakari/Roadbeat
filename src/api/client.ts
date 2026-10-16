import type { Point } from 'geojson'
import type {
  Camera,
  CameraKind,
  CameraProperties,
  DumpPoint,
  EventProperties,
  FeatureCollection,
  RestArea,
  RoadContact,
  TrafficEvent,
  TransitLine,
  TransitMode,
  TransitNotice,
  TruckRestriction,
  WazeReport,
} from './types'

// The QLDTraffic website itself reads these public feeds. Unlike the documented
// api.qldtraffic.qld.gov.au endpoints, every feed here sends
// Access-Control-Allow-Origin: *, so the app works as a plain static site:
// no proxy and no API key.
export const QLDTRAFFIC_DATA_BASE: string = import.meta.env.VITE_QLDTRAFFIC_DATA_BASE ?? 'https://data.qldtraffic.qld.gov.au'
const DATA = QLDTRAFFIC_DATA_BASE
const LOOKUP = 'https://r8s97t2t19.execute-api.ap-southeast-2.amazonaws.com/prod/lookuproad'
export const RAIN_RADAR = 'https://rainradar.qldtraffic.qld.gov.au/radarimage'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  // Feeds are regenerated in place; bypass the HTTP cache so polling sees updates.
  const res = await fetch(url, { signal, cache: 'no-cache' })
  if (!res.ok) throw new ApiError(res.status, `QLDTraffic responded with ${res.status}.`)
  const text = await res.text()
  // Some feeds are briefly empty while being rewritten.
  return (text.trim() ? JSON.parse(text) : null) as T
}

export interface EventsResponse {
  events: TrafficEvent[]
  published: string | null
}

export async function fetchEvents(signal?: AbortSignal): Promise<EventsResponse> {
  const data = await get<FeatureCollection<TrafficEvent['geometry'], EventProperties> | null>(
    `${DATA}/events_v2.geojson`,
    signal,
  )
  if (!data) throw new ApiError(503, 'The events feed is being updated. Trying again shortly.')
  return { events: data.features, published: data.published ?? null }
}

async function fetchCameraKind(kind: CameraKind, signal?: AbortSignal): Promise<Camera[]> {
  const file = kind === 'webcam' ? 'webcameras.geojson' : 'floodcameras.geojson'
  const data = await get<FeatureCollection<Point, CameraProperties> | null>(`${DATA}/${file}`, signal)
  return (data?.features ?? [])
    .filter((f) => f.geometry?.coordinates?.length === 2)
    .map((f) => ({ ...f, kind }))
}

export async function fetchCameras(signal?: AbortSignal): Promise<Camera[]> {
  const [web, flood] = await Promise.all([fetchCameraKind('webcam', signal), fetchCameraKind('floodcam', signal)])
  return [...web, ...flood]
}

const bool = (v: unknown) => v === true || v === 'true' || v === 'T' || v === 'yes'

export async function fetchRestAreas(): Promise<RestArea[]> {
  const data = await get<FeatureCollection<Point, Record<string, string>> | null>(`${DATA}/QLD_RA_LITE.geojson`)
  return (data?.features ?? []).map((f) => {
    const p = f.properties
    return {
      id: p.id,
      name: p.Name?.trim() || null,
      type: p.type,
      toilet: bool(p.Toilet),
      accessibleToilet: bool(p.Toilet_disabled),
      water: p.Wsupply && p.Wsupply !== 'None' ? p.Wsupply : null,
      carBays: bool(p.Motorist_bays),
      truckBays: p.Truck_bays && p.Truck_bays !== 'None' && p.Truck_bays !== '0' ? p.Truck_bays : null,
      heavyVehicle: bool(p.Heavy_vehicle),
      coordinates: f.geometry.coordinates as [number, number],
    }
  })
}

export async function fetchDumpPoints(): Promise<DumpPoint[]> {
  const data = await get<FeatureCollection<Point, { name: string; description: string }> | null>(
    `${DATA}/rvEffluentDumpSites.geojson`,
  )
  return (data?.features ?? []).map((f, i) => ({
    id: String(i),
    name: f.properties.name,
    description: f.properties.description,
    coordinates: f.geometry.coordinates as [number, number],
  }))
}

export async function fetchTruckRestrictions(): Promise<TruckRestriction[]> {
  const data = await get<FeatureCollection<TruckRestriction['geometry'], TruckRestriction['properties']> | null>(
    `${DATA}/restrictedtruck.geojson`,
  )
  return (data?.features ?? []) as TruckRestriction[]
}

export async function fetchWaze(): Promise<WazeReport[]> {
  const data = await get<WazeReport[] | null>(`${DATA}/displayed_waze_events.json`)
  return data ?? []
}

export async function fetchDistricts(): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { district: string }>> {
  const data = await get<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { district: string }> | null>(
    `${DATA}/districts.geojson`,
  )
  return data ?? { type: 'FeatureCollection', features: [] }
}

/** Who manages the road at a point (council, TMR district, state centre). */
export async function fetchRoadContacts(lng: number, lat: number, signal?: AbortSignal): Promise<RoadContact[]> {
  const data = await get<RoadContact[] | null>(`${LOOKUP}?lat=${lat}&lng=${lng}`, signal)
  return data ?? []
}

interface RssChannel {
  channel: {
    pubDate?: string
    item?: RssItem | RssItem[]
  }
}
interface RssItem {
  title: string
  link: string
  description: string
  category?: { '#cdata-section': string } | { '#cdata-section': string }[]
}

const items = (c: RssChannel | null) => {
  const it = c?.channel?.item
  return !it ? [] : Array.isArray(it) ? it : [it]
}
const cats = (i: RssItem) =>
  (Array.isArray(i.category) ? i.category : i.category ? [i.category] : [])
    .map((c) => c['#cdata-section'].replace(/^[\s,]+|\s+$/g, ''))
    .filter(Boolean)

const MODE_FILES: Record<TransitMode, string> = { train: 'trains', bus: 'bus', ferry: 'ferries', tram: 'trams' }

export async function fetchTransit(): Promise<{ lines: TransitLine[]; notices: TransitNotice[] }> {
  const modes = Object.keys(MODE_FILES) as TransitMode[]
  const [feeds, notices] = await Promise.all([
    Promise.all(modes.map((m) => get<RssChannel | null>(`${DATA}/translink/${MODE_FILES[m]}.json`).catch(() => null))),
    get<RssChannel | null>(`${DATA}/translink/serviceNotice.json`).catch(() => null),
  ])
  const lines = modes.flatMap((mode, i) =>
    items(feeds[i]).map((it) => ({
      mode,
      name: it.title.trim(),
      status: it.description.trim(),
      link: it.link,
      region: cats(it).find((c) => !/^(train|bus|ferry|tram)s?$/i.test(c)) ?? null,
    })),
  )
  return {
    lines,
    notices: items(notices).map((it) => {
      const c = cats(it)
      return {
        title: it.title.replace(/^[ⓘ☒⚠\s]+/, '').trim(),
        link: it.link,
        description: it.description.trim(),
        upcoming: c.includes('Upcoming'),
        severity: (['Major', 'Minor', 'Informative'].find((s) => c.includes(s)) ?? 'Informative') as TransitNotice['severity'],
        region: c.find((x) => !['Current', 'Upcoming', 'Major', 'Minor', 'Informative'].includes(x)) ?? null,
      }
    }),
  }
}
