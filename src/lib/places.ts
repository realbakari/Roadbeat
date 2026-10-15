import type { AccessibleBay, Clearway, Toilet } from '../api/bccPlaces'
import type { Clearance } from '../api/clearances'
import type { DumpPoint, RestArea, TruckRestriction, WazeReport } from '../api/types'
import type { MapLayers } from '../components/map/settings'
import type { LngLat } from './geo'

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
    const data = s.truckRestrictions.find((t) => String(t.properties.id) === id)
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
      const p = place.data.geometry.coordinates[0]?.[0]
      return p ? { center: [p[0], p[1]], zoom: 12 } : null
    }
    case 'clearance':
    case 'bay':
      return { center: place.data.position, zoom: 16 }
    case 'toilet':
      return { center: place.data.position, zoom: 15 }
    case 'clearway':
      return { center: firstPoint(place.data.geometry), zoom: 15 }
    case 'rest':
    case 'dump':
      return { center: place.data.coordinates, zoom: 13 }
  }
}
