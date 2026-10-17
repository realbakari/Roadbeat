import type { Feature as GjFeature, FeatureCollection as GjCollection, Geometry, Position } from 'geojson'
import type { Camera, DumpPoint, RestArea, TrafficEvent, TruckRestriction, WazeReport } from '../api/types'
import { CAMERA_COLOR, priorityRank, typeMeta } from './eventMeta'
import { isClosure, isUpcoming } from './filters'
import { eventIconId } from './mapIcons'
import { eventMarkerPoints, flatten, type LngLat } from './eventAnchor'
import { truckIconPoint, truckKey } from './trucks'

export { eventAnchor, eventBounds, type Bounds, type LngLat } from './eventAnchor'

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
    const p = e.properties
    const future = isUpcoming(e)
    const properties = {
      id: p.id,
      color: typeMeta(p.event_type).color,
      rank: priorityRank(p.event_priority),
      area: false,
      future,
      icon: eventIconId(p.event_type, isClosure(e) ? (p.impact?.impact_subtype ?? 'closed') : null, future),
    }
    for (const at of eventMarkerPoints(e)) features.push({ type: 'Feature', id: p.id, geometry: { type: 'Point', coordinates: at }, properties })
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
    const props = { key: `place/truck/${truckKey(t)}`, icon: 'truck-restriction', color: '', label: t.properties.name }
    features.push({ type: 'Feature', geometry: t.geometry, properties: props })
    const icon = truckIconPoint(t)
    if (icon) features.push(point(icon, props))
  }
  return { type: 'FeatureCollection', features }
}

/** A stable key per camera. Council dashboards number cameras from 1 each, so a council camera's key carries its council. */
export function cameraKey(c: Camera): string {
  return c.council ? `${c.kind}-${c.council.toLowerCase().replace(/[^a-z]+/g, '-')}-${c.properties.id}` : `${c.kind}-${c.properties.id}`
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
