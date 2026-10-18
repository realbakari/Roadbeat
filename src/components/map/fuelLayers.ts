import type * as maplibregl from 'maplibre-gl'
import { FUEL_STATUS_LABEL, type FuelStation } from '../../api/fuelAvailability'
import { brandedName } from '../../lib/fuelBrands'

// Service stations at their published points, each with the icon for the
// status the layer gives it. Stations with no fuel are drawn on top, so a
// cluster of available ones never hides them.

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const RANK = { unavailable: 3, partial: 2, unknown: 1, available: 0 } as const

export function fuelFeatures(stations: FuelStation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: s.position },
      properties: { key: `place/fuel/${encodeURIComponent(s.id)}`, icon: `fuel-${s.status}`, rank: RANK[s.status], label: `${brandedName(s)} · ${FUEL_STATUS_LABEL[s.status]}` },
    })),
  }
}

/** Adds the source and layer, hidden until the switch turns it on. */
export function addFuelLayers(map: maplibregl.Map) {
  map.addSource('fuel', { type: 'geojson', data: empty })
  map.addLayer({
    id: 'fuel',
    type: 'symbol',
    source: 'fuel',
    layout: {
      visibility: 'none',
      'icon-image': ['get', 'icon'] as never,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 12, 0.85] as never,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['get', 'rank'] as never,
    },
  })
}
