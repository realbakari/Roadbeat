import type { CouncilEvent } from '../api/bccDashboard'
import type { AccessibleBay, BikeStop, Clearway, ParkingMeter, Toilet } from '../api/bccPlaces'
import type { Clearance } from '../api/clearances'
import type { AirStation } from '../api/airQuality'
import type { Hotspot } from '../api/hotspots'
import type { QldWarning } from '../api/qldWarnings'
import type { NswFire } from '../api/nswFires'
import type { Cyclone } from '../api/jtwc'
import type { PastCyclone } from '../api/pastCyclones'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { DumpPoint, RestArea, TruckRestriction, WazeReport } from '../api/types'
import type { MapLayers } from '../components/map/settings'
import type { LngLat } from './geo'
import { outagePosition } from './outages'
import { findTruck, truckIconPoint } from './trucks'

/** A map item that has its own detail page, reached by #place/<kind>/<id>. */
export type Place =
  | { kind: 'rest'; data: RestArea }
  | { kind: 'dump'; data: DumpPoint }
  | { kind: 'truck'; data: TruckRestriction }
  | { kind: 'waze'; data: WazeReport }
  | { kind: 'clearance'; data: Clearance }
  | { kind: 'clearway'; data: Clearway }
  | { kind: 'toilet'; data: Toilet }
  | { kind: 'bay'; data: AccessibleBay }
  | { kind: 'meter'; data: ParkingMeter }
  | { kind: 'bike'; data: BikeStop }
  | { kind: 'event'; data: CouncilEvent }
  | { kind: 'centre'; data: CouncilCentre }
  | { kind: 'outage'; data: Outage }
  | { kind: 'air'; data: AirStation }
  | { kind: 'hotspot'; data: Hotspot }
  | { kind: 'warning'; data: QldWarning }
  | { kind: 'nswfire'; data: NswFire }
  | { kind: 'cyclone'; data: Cyclone }
  | { kind: 'pastcyclone'; data: PastCyclone }

/** The loaded lists a place link can point into; null while a list has not loaded. */
export interface PlaceSources {
  restAreas: RestArea[]
  dumpPoints: DumpPoint[]
  truckRestrictions: TruckRestriction[]
  waze: WazeReport[]
  clearances: Clearance[] | null
  clearways: Clearway[] | null
  toilets: Toilet[] | null
  bays: AccessibleBay[] | null
  meters: ParkingMeter[] | null
  bikeStops: BikeStop[] | null
  councilEvents: CouncilEvent[] | null
  councilCentres: CouncilCentre[] | null
  outages: Outage[] | null
  airStations: AirStation[] | null
  hotspots: Hotspot[] | null
  warnings: QldWarning[] | null
  nswFires: NswFire[] | null
  cyclones: Cyclone[] | null
  pastCyclones: PastCyclone[] | null
}

/** The map layer a shared link to a place turns on. */
export const PLACE_LAYER: Partial<Record<string, keyof MapLayers>> = {
  rest: 'restAreas',
  dump: 'dumpPoints',
  truck: 'trucks',
  waze: 'waze',
  clearance: 'clearances',
  clearway: 'clearways',
  toilet: 'toilets',
  bay: 'accessibleParking',
  meter: 'parkingMeters',
  bike: 'cycling',
  event: 'councilEvents',
  centre: 'councilCentres',
  outage: 'outages',
  air: 'airQuality',
  hotspot: 'hotspots',
  warning: 'warnings',
  nswfire: 'nswFires',
  cyclone: 'cyclones',
  pastcyclone: 'pastCyclones',
}

/** The place a #place/<kind>/<id> link names, or null when it is unknown or not loaded yet. */
export function findPlace(ref: { kind: string; id: string }, s: PlaceSources): Place | null {
  const { kind, id } = ref
  if (kind === 'rest') {
    const data = s.restAreas.find((r) => r.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'dump') {
    const data = s.dumpPoints.find((d) => d.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'truck') {
    const data = findTruck(s.truckRestrictions, id)
    return data ? { kind, data } : null
  }
  if (kind === 'waze') {
    const data = s.waze.find((w) => w.uuid === id)
    return data ? { kind, data } : null
  }
  if (kind === 'clearance') {
    const data = s.clearances?.find((c) => c.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'clearway') {
    const data = s.clearways?.find((c) => c.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'toilet') {
    const data = s.toilets?.find((t) => t.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'bay') {
    const data = s.bays?.find((b) => b.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'meter') {
    const data = s.meters?.find((m) => m.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'bike') {
    const data = s.bikeStops?.find((b) => b.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'event') {
    const data = s.councilEvents?.find((e) => e.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'centre') {
    const data = s.councilCentres?.find((c) => c.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'outage') {
    const data = s.outages?.find((o) => o.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'air') {
    const data = s.airStations?.find((a) => a.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'hotspot') {
    const data = s.hotspots?.find((h) => h.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'warning') {
    const data = s.warnings?.find((w) => w.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'nswfire') {
    const data = s.nswFires?.find((f) => f.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'cyclone') {
    const data = s.cyclones?.find((c) => c.id === id)
    return data ? { kind, data } : null
  }
  if (kind === 'pastcyclone') {
    const data = s.pastCyclones?.find((c) => c.id === id)
    return data ? { kind, data } : null
  }
  return null
}

function firstPoint(g: GeoJSON.LineString | GeoJSON.MultiLineString): LngLat {
  const p = g.type === 'LineString' ? g.coordinates[0] : g.coordinates[0][0]
  return [p[0], p[1]]
}

/** Where the map flies to when a place opens, or null when the place has no point to show. */
export function placeFocus(place: Place): { center: LngLat; zoom: number } | null {
  switch (place.kind) {
    case 'waze':
      return { center: [place.data.location.x, place.data.location.y], zoom: 13 }
    case 'truck': {
      const p = truckIconPoint(place.data)
      return p ? { center: p, zoom: 12 } : null
    }
    case 'clearance':
    case 'bay':
      return { center: place.data.position, zoom: 16 }
    case 'meter':
    case 'bike':
      return { center: place.data.position, zoom: 17 }
    case 'toilet':
    case 'centre':
      return { center: place.data.position, zoom: 15 }
    case 'air':
      return { center: place.data.position, zoom: 12 }
    case 'hotspot':
      return { center: place.data.position, zoom: 11 }
    case 'warning':
      return { center: place.data.position, zoom: 10 }
    case 'nswfire':
      return { center: place.data.position, zoom: 11 }
    case 'cyclone':
      return { center: place.data.points[0].position, zoom: 5 }
    case 'pastcyclone': {
      // The track's middle reported position, so the view centres on the storm's path.
      const p = place.data.points[Math.floor(place.data.points.length / 2)]
      return { center: p.position, zoom: 5 }
    }
    case 'event':
      return place.data.position ? { center: place.data.position, zoom: 15 } : null
    case 'outage': {
      const p = outagePosition(place.data)
      return p ? { center: p, zoom: place.data.place ? 13 : 15 } : null
    }
    case 'clearway':
      return { center: firstPoint(place.data.geometry), zoom: 15 }
    case 'rest':
    case 'dump':
      return { center: place.data.coordinates, zoom: 13 }
  }
}
