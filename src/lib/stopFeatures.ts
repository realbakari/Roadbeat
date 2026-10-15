import { loadStops } from '../api/stops'
import { loadTimetableIndex, routesAtStops } from '../api/timetables'
import { routeInfo } from '../api/translink'

export interface StopFeatureProps {
  /** App hash the stop opens. */
  key: string
  label: string
  /** Rail, tram or ferry station / stop, or a bus stop. */
  kind: 'station' | 'bus'
  /** "|BRCA|CABR|": route codes calling here, for matching a highlighted line. */
  codes: string
}

let features: Promise<GeoJSON.FeatureCollection<GeoJSON.Point, StopFeatureProps>> | null = null

/**
 * Every TransLink station and stop as map points, like the stations on
 * TransLink's network map. Platforms are left to their station; a station is
 * any stop a train, tram or ferry route calls at in the published timetable.
 */
export function loadStopFeatures() {
  features ??= Promise.all([loadStops(true), loadTimetableIndex()]).then(([stops, index]) => {
    const out: GeoJSON.Feature<GeoJSON.Point, StopFeatureProps>[] = []
    for (const s of stops.all()) {
      if (s.parent) continue
      const codes = index ? routesAtStops(index, s.region, [s.id, ...stops.children(s).map((c) => c.id)]) : []
      if (!codes.length) continue // not served by any published trip
      const station = codes.some((c) => (routeInfo(c, s.region)?.mode ?? 'bus') !== 'bus')
      out.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: s.position },
        properties: {
          key: `transit/stop/${s.region}/${encodeURIComponent(s.id)}`,
          label: s.name,
          kind: station ? 'station' : 'bus',
          codes: station ? `|${codes.join('|')}|` : '',
        },
      })
    }
    return { type: 'FeatureCollection', features: out }
  })
  return features
}
