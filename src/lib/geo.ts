import type { Feature as GjFeature, FeatureCollection as GjCollection, Geometry, Position } from 'geojson'
import type { Camera, DumpPoint, RestArea, TrafficEvent, TruckRestriction, WazeReport } from '../api/types'
import { CAMERA_COLOR, priorityRank, typeMeta } from './eventMeta'
import { isClosure, isUpcoming } from './filters'
import { eventIconId } from './mapIcons'

export type LngLat = [number, number]
export type Bounds = [LngLat, LngLat]

/** Splits GeometryCollections so MapLibre gets plain geometries. */
function flatten(g: Geometry | null): Geometry[] {
  if (!g) return []
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(flatten)
  return [g]
}

function positions(g: Geometry): Position[] {
  switch (g.type) {
    case 'Point':
      return [g.coordinates]
    case 'MultiPoint':
    case 'LineString':
      return g.coordinates
    case 'MultiLineString':
    case 'Polygon':
      return g.coordinates.flat()
    case 'MultiPolygon':
      return g.coordinates.flat(2)
    default:
      return []
  }
}

export function eventBounds(e: TrafficEvent): Bounds | null {
  const pts = flatten(e.geometry).flatMap(positions)
  if (!pts.length) return null
  let [minX, minY] = pts[0]
  let [maxX, maxY] = pts[0]
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

/** A point to pin the event marker on: the first point, or the middle of the first line. */
export function eventAnchor(e: TrafficEvent): LngLat | null {
  const geoms = flatten(e.geometry)
  const point = geoms.find((g) => g.type === 'Point' || g.type === 'MultiPoint')
  if (point) return positions(point)[0] as LngLat
  const line = geoms.find((g) => g.type === 'LineString' || g.type === 'MultiLineString')
  if (line) {
    const pts = line.type === 'LineString' ? line.coordinates : line.coordinates[0]
    return pts[Math.floor(pts.length / 2)] as LngLat
  }
  const any = geoms.flatMap(positions)[0]
  return any ? (any as LngLat) : null
}

interface EventFeatureProps {
  id: number
  color: string
  rank: number
  area: boolean
  icon?: string
  future?: boolean
}

export function eventShapes(events: TrafficEvent[]): GjCollection<Geometry, EventFeatureProps> {
  const features: GjFeature<Geometry, EventFeatureProps>[] = []
  for (const e of events) {
    const p = e.properties
    const geoms = flatten(e.geometry)
    geoms.forEach((g, i) => {
      // Per spec 4.3: when area_alert is true the last geometry is the alert area.
      const area = !!p.area_alert && i === geoms.length - 1
      features.push({
        type: 'Feature',
        geometry: g,
        properties: { id: p.id, color: typeMeta(p.event_type).color, rank: priorityRank(p.event_priority), area, future: isUpcoming(e) },
      })
    })
  }
  return { type: 'FeatureCollection', features }
}

export function eventMarkers(events: TrafficEvent[]): GjCollection<Geometry, EventFeatureProps> {
  const features: GjFeature<Geometry, EventFeatureProps>[] = []
  for (const e of events) {
    const anchor = eventAnchor(e)
    if (!anchor) continue
    const p = e.properties
    const future = isUpcoming(e)
    features.push({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: anchor },
      properties: {
        id: p.id,
        color: typeMeta(p.event_type).color,
        rank: priorityRank(p.event_priority),
        area: false,
        future,
        icon: eventIconId(p.event_type, isClosure(e) ? (p.impact?.impact_subtype ?? 'closed') : null, future),
      },
    })
  }
  // Draw higher-priority markers last so they sit on top.
  features.sort((a, b) => b.properties.rank - a.properties.rank)
  return { type: 'FeatureCollection', features }
}

type PlaceProps = { key: string; icon: string; color: string; label: string }

const point = (coordinates: Position, properties: PlaceProps): GjFeature<Geometry, PlaceProps> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties,
})

export function cameraMarkers(cameras: Camera[]): GjCollection<Geometry, PlaceProps> {
  return {
    type: 'FeatureCollection',
    features: cameras.map((c) =>
      point(c.geometry.coordinates, {
        key: `camera/${cameraKey(c)}`,
        icon: `camera-${c.kind}`,
        color: CAMERA_COLOR[c.kind],
        label: c.properties.description,
      }),
    ),
  }
}

/**
 * Rest areas, dump points and Waze reports share one source: every feature
 * carries its icon and the hash route it opens (e.g. "place/rest/long007").
 */
export function placeMarkers(
  restAreas: RestArea[],
  dumpPoints: DumpPoint[],
  waze: WazeReport[],
): GjCollection<Geometry, PlaceProps> {
  return {
    type: 'FeatureCollection',
    features: [
      ...restAreas.map((r) =>
        point(r.coordinates, {
          key: `place/rest/${r.id}`,
          icon: r.heavyVehicle ? 'rest-area-hv' : 'rest-area',
          color: '',
          label: r.name ?? 'Rest area',
        }),
      ),
      ...dumpPoints.map((d) =>
        point(d.coordinates, { key: `place/dump/${d.id}`, icon: 'dump-point', color: '', label: `RV dump point · ${d.name}` }),
      ),
      ...waze.map((w) =>
        point([w.location.x, w.location.y], {
          key: `place/waze/${w.uuid}`,
          icon: 'waze',
          color: '',
          label: `Waze report · ${w.street ?? w.city ?? 'Crash'}`,
        }),
      ),
    ],
  }
}

export function truckLines(trucks: TruckRestriction[]): GjCollection<Geometry, PlaceProps> {
  const features: GjFeature<Geometry, PlaceProps>[] = []
  for (const t of trucks) {
    const props = { key: `place/truck/${t.properties.id}`, icon: 'truck-restriction', color: '', label: t.properties.name }
    features.push({ type: 'Feature', geometry: t.geometry, properties: props })
    const lines = t.geometry.coordinates
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), lines[0] ?? [])
    if (longest.length) features.push(point(longest[Math.floor(longest.length / 2)], props))
  }
  return { type: 'FeatureCollection', features }
}

export function cameraKey(c: Camera): string {
  return `${c.kind}-${c.properties.id}`
}

/** Great-circle distance in km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function vehicleMarkers(vehicles: import('../api/translink').LiveVehicle[]): GjCollection<Geometry, PlaceProps & { route: string; mode: string }> {
  return {
    type: 'FeatureCollection',
    features: vehicles.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: v.position },
      properties: {
        key: `vehicle/${v.id}`,
        icon: `vehicle-${v.mode}`,
        color: '',
        mode: v.mode,
        route: v.mode === 'train' ? '' : v.route,
        label: v.lineName
          ? `${v.lineName} · ${v.routeName ?? ''}`
          : `${v.mode === 'tram' ? 'Tram' : v.mode === 'ferry' ? 'Ferry' : 'Bus'} ${v.route}${v.routeName ? ` · ${v.routeName}` : ''}`,
      },
    })),
  }
}
