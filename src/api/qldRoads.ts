import { z } from 'zod'

// Queensland's official road network: the Department of Resources' "Queensland
// roads and tracks" (data.qld.gov.au, CC BY 4.0), queried through its ArcGIS
// service. The news monitor asks it for the segments of named roads inside
// named localities. The service sends no CORS headers, so only the server calls it.

export const ROADS_SERVICE = 'https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Transportation/RoadsAndTracks/MapServer/10/query'

/** The service's page size; a road and locality pair rarely has more than a few dozen segments. */
const MAX_SEGMENTS = 2000

/** Names the query may contain: letters, spaces, hyphens and apostrophes, which are escaped. */
const SAFE_NAME = /^[A-Za-z' -]+$/

const quoted = (values: string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')

/**
 * The query URL for every segment of `roads` with either side in one of
 * `localities`, with geometry in WGS 84 simplified to about 10 m. Names with
 * other characters are left out rather than escaped further. Null when nothing is left to ask.
 */
export function roadQueryUrl(roads: string[], localities: string[]): string | null {
  const r = roads.filter((n) => SAFE_NAME.test(n))
  const l = localities.filter((n) => SAFE_NAME.test(n))
  if (!r.length || !l.length) return null
  const where = `road_name_full IN (${quoted(r)}) AND (locality_left IN (${quoted(l)}) OR locality_right IN (${quoted(l)}))`
  const params = new URLSearchParams({
    where,
    outFields: 'road_name_full,locality_left,locality_right',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '5',
    maxAllowableOffset: '0.0001',
    resultRecordCount: String(MAX_SEGMENTS),
    f: 'json',
  })
  return `${ROADS_SERVICE}?${params}`
}

const Response = z.object({
  features: z.array(
    z.object({
      attributes: z.object({ road_name_full: z.string().nullable(), locality_left: z.string().nullable(), locality_right: z.string().nullable() }),
      geometry: z.object({ paths: z.array(z.array(z.tuple([z.number(), z.number()]))) }).nullable().optional(),
    }),
  ),
})

/** One stretch of road as the dataset publishes it: its name, the locality on each side and its line. */
export interface RoadSegment {
  road: string
  localityLeft: string | null
  localityRight: string | null
  path: [number, number][]
}

/** Segments from a query response. Segments without a name or geometry are dropped; multi-part segments become one path per part. */
export function parseRoadSegments(json: unknown): RoadSegment[] {
  return Response.parse(json).features.flatMap(({ attributes: a, geometry }) => {
    const road = a.road_name_full
    if (!road || !geometry) return []
    return geometry.paths.filter((p) => p.length > 1).map((path) => ({ road, localityLeft: a.locality_left, localityRight: a.locality_right, path }))
  })
}
