import type { Geometry } from 'geojson'
import { z } from 'zod'
import type { Camera, CameraKind, CameraProperties, EventProperties, TrafficEvent } from './types.js'

// Boundary parsers for the QLDTraffic road event and camera feeds. A feature
// the app can't use (no id, no type, a camera with no point) is dropped rather
// than failing the whole feed, so one bad record never blanks the map. Fields
// are kept as published; a field of the wrong type becomes null, which the
// app already treats as "not published". Free of browser-only code, so the
// server functions in api/ can share it.

/** A text field: kept as published when it is text, otherwise null. */
const text = z.string().nullable().catch(null)

const Impact = z
  .looseObject({ direction: text, towards: text, impact_type: text, impact_subtype: text, delay: text })
  .nullable()
  .catch(null)

const Recurrence = z.looseObject({ event_id: z.number(), description: text, impact: Impact })

const Duration = z
  .looseObject({
    start: text,
    end: text,
    active_days: z.array(z.string()).nullable().catch(null),
    // A recurrence the app can't read is dropped; the others still show.
    recurrences: z
      .array(z.unknown())
      .nullable()
      .catch(null)
      .transform((list) =>
        list?.flatMap((r) => {
          const p = Recurrence.safeParse(r)
          return p.success ? [p.data] : []
        }) ?? null,
      ),
  })
  .nullable()
  .catch(null)

const Source = z
  .looseObject({ source_name: text, source_id: text, account: text, provided_by: text, provided_by_url: text })
  .nullable()
  .catch(null)

const RoadSummary = z
  .looseObject({ road_name: text, locality: text, postcode: text, local_government_area: text, district: text })
  .nullable()
  .catch(null)

const EventProps = z.looseObject({
  id: z.number(),
  event_type: z.string(),
  event_priority: z.string(),
  status: z.string().catch(''),
  url: z.string().catch(''),
  published: text,
  source: Source,
  event_subtype: text,
  event_due_to: text,
  impact: Impact,
  duration: Duration,
  description: text,
  advice: text,
  information: text,
  road_summary: RoadSummary,
  last_updated: text,
  next_inspection: text,
  web_link: text,
})

// How deeply each geometry type nests its positions.
const DEPTH: Record<string, number> = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 }

const isPosition = (p: unknown) => Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n))
const nested = (c: unknown, depth: number): boolean => (depth === 0 ? isPosition(c) : Array.isArray(c) && c.every((x) => nested(x, depth - 1)))

/** A GeoJSON geometry whose positions are all numbers. */
export function isGeometry(g: unknown): g is Geometry {
  if (!g || typeof g !== 'object') return false
  const { type, coordinates, geometries } = g as Record<string, unknown>
  if (type === 'GeometryCollection') return Array.isArray(geometries) && geometries.every(isGeometry)
  return typeof type === 'string' && type in DEPTH && nested(coordinates, DEPTH[type])
}

const features = (json: unknown): unknown[] | null => {
  const list = json && typeof json === 'object' ? (json as { features?: unknown }).features : null
  return Array.isArray(list) ? list : null
}

/**
 * Road events from events_v2.geojson. An event with unreadable geometry keeps
 * its place in the list with no shape, as events with no geometry already do.
 * Throws when the body isn't a feature collection at all.
 */
export function parseEvents(json: unknown): { events: TrafficEvent[]; published: string | null } {
  const list = features(json)
  if (!list) throw new Error('The events feed is not a feature collection')
  const events = list.flatMap((f): TrafficEvent[] => {
    if (!f || typeof f !== 'object') return []
    const { geometry, properties } = f as Record<string, unknown>
    const p = EventProps.safeParse(properties)
    if (!p.success) return []
    return [{ type: 'Feature', geometry: isGeometry(geometry) ? geometry : null, properties: p.data as EventProperties }]
  })
  const published = (json as { published?: unknown }).published
  return { events, published: typeof published === 'string' ? published : null }
}

const CameraProps = z.looseObject({
  id: z.number(),
  image_url: z.string(),
  url: z.string().catch(''),
  description: z.string().catch(''),
  direction: text,
  district: text,
  locality: text,
  postcode: text,
})

/** Cameras from webcameras.geojson or floodcameras.geojson. Cameras without a [lng, lat] point or an image are dropped. */
export function parseCameras(json: unknown, kind: CameraKind): Camera[] {
  return (features(json) ?? []).flatMap((f): Camera[] => {
    if (!f || typeof f !== 'object') return []
    const { geometry, properties } = f as Record<string, unknown>
    const g = geometry as { type?: unknown; coordinates?: unknown } | null
    if (g?.type !== 'Point' || !isPosition(g.coordinates) || (g.coordinates as number[]).length !== 2) return []
    const p = CameraProps.safeParse(properties)
    if (!p.success) return []
    return [{ type: 'Feature', kind, geometry: { type: 'Point', coordinates: g.coordinates as [number, number] }, properties: p.data as CameraProperties }]
  })
}
