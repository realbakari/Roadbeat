import type * as maplibregl from 'maplibre-gl'
import { SPEED_CAMERA_LABEL, type SpeedCamera } from '../../api/speedCameras'

// The state's fixed, red light and point-to-point camera sites, each at the
// point the Queensland Government's camera map gives it. A point-to-point
// section is drawn as its two published points only: the map gives no line
// between them, so none is drawn.

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function speedCameraFeatures(cameras: SpeedCamera[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cameras.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c.position },
      properties: { key: `place/speedcamera/${encodeURIComponent(c.id)}`, icon: `speedcam-${c.type}`, label: `${SPEED_CAMERA_LABEL[c.type]} · ${c.site}` },
    })),
  }
}

/** Adds the source and layer, hidden until the switch turns it on. */
export function addSpeedCameraLayers(map: maplibregl.Map) {
  map.addSource('speed-cameras', { type: 'geojson', data: empty })
  map.addLayer({
    id: 'speed-cameras',
    type: 'symbol',
    source: 'speed-cameras',
    layout: { visibility: 'none', 'icon-image': ['get', 'icon'] as never, 'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.55, 13, 0.9] as never, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  })
}
