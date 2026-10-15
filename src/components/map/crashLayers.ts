import type { Map as MapLibreMap } from 'maplibre-gl'
import { SEVERITIES, SEVERITY_COLOR } from '../../api/crashes'

/** Below this zoom crashes show as a heatmap; at or above it, as individual points. */
export const CRASH_POINT_ZOOM = 12

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Sources and layers for crash history, added below the live events. */
export function addCrashLayers(map: MapLibreMap) {
  map.addSource('crash-grid', { type: 'geojson', data: EMPTY })
  map.addSource('crash-points', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'crash-heat',
    type: 'heatmap',
    source: 'crash-grid',
    maxzoom: CRASH_POINT_ZOOM,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['get', 'w'],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 10, 11, 18],
      'heatmap-intensity': 2.5,
      'heatmap-opacity': 0.75,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(254,240,138,0)',
        0.15,
        'rgba(253,224,71,0.6)',
        0.4,
        '#fb923c',
        0.7,
        '#dc2626',
        1,
        '#7f1d1d',
      ],
    },
  })
  map.addLayer({
    id: 'crash-points',
    type: 'circle',
    source: 'crash-points',
    minzoom: CRASH_POINT_ZOOM,
    layout: { visibility: 'none' },
    paint: {
      'circle-color': [
        'match',
        ['get', 'severity'],
        ...SEVERITIES.flatMap((s) => [s, SEVERITY_COLOR[s]]),
        '#94a3b8',
      ] as never,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        12,
        ['match', ['get', 'severity'], 'Fatal', 5, 'Hospitalisation', 4, 3],
        16,
        ['match', ['get', 'severity'], 'Fatal', 8, 'Hospitalisation', 7, 6],
      ],
      'circle-opacity': 0.85,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.8,
    },
  })
}
