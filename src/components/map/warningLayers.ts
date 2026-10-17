import type { Map as MapLibreMap } from 'maplibre-gl'

// Queensland's severe weather, flood and cyclone warnings (src/api/qldWarnings.ts):
// each warning's published area, shaded in its level's colour, and a marker at
// the point the feed gives. Nothing is drawn beyond the published polygons.

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const color = ['get', 'color'] as unknown as string
const AREAS = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]] as never

/** The source and the area layers, added with the other warning areas under everything else. */
export function addWarningAreas(map: MapLibreMap) {
  map.addSource('qld-warnings', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'warning-areas', type: 'fill', source: 'qld-warnings', filter: AREAS, paint: { 'fill-color': color, 'fill-opacity': 0.16 } })
  map.addLayer({
    id: 'warning-area-lines',
    type: 'line',
    source: 'qld-warnings',
    filter: AREAS,
    paint: { 'line-color': color, 'line-width': 1.5 },
  })
}

/** Each warning's marker, higher levels on top, added with the bushfire markers. */
export function addWarningMarkers(map: MapLibreMap) {
  map.addLayer({
    id: 'warning-markers',
    type: 'circle',
    source: 'qld-warnings',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: { 'circle-sort-key': ['get', 'rank'] as never },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 11, 9] as never,
      'circle-color': color,
      'circle-stroke-color': '#1d1d1d',
      'circle-stroke-width': 2,
    },
  })
}
