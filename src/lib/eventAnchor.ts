import type { Geometry, Position } from 'geojson'
import type { TrafficEvent } from '../api/types.js'
import type { LngLat } from './distance.js'

// Where a QLDTraffic event sits on the map, from its published geometry alone.
// Free of browser-only code, so the server's event history (api/) shares it.

export type { LngLat }
export type Bounds = [LngLat, LngLat]

/** Splits GeometryCollections so MapLibre gets plain geometries. */
export function flatten(g: Geometry | null): Geometry[] {
  if (!g) return []
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(flatten)
  return [g]
}

export function positions(g: Geometry): Position[] {
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

/** The box around a set of points, or null for none. A loop, not Math.min(...xs), so a long track can't overflow the stack. */
export function pointBounds(pts: Position[]): Bounds | null {
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

export function eventBounds(e: TrafficEvent): Bounds | null {
  return pointBounds(flatten(e.geometry).flatMap(positions))
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

/**
 * Every point to pin the event's marker on. An event published at several
 * points (a MultiPoint, or a GeometryCollection holding more than one Point)
 * gets a marker at each, because each is a site QLDTraffic names: two flooded
 * crossings 28 km apart, say. Otherwise, the single anchor.
 */
export function eventMarkerPoints(e: TrafficEvent): LngLat[] {
  const points = flatten(e.geometry)
    .filter((g) => g.type === 'Point' || g.type === 'MultiPoint')
    .flatMap(positions)
    .map((p) => [p[0], p[1]] as LngLat)
  if (points.length) return points
  const anchor = eventAnchor(e)
  return anchor ? [anchor] : []
}
