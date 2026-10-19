import type * as maplibregl from 'maplibre-gl'
import { NSW_ALERT_COLOR, type NswFire } from '../../api/nswFires'
import { nswFireIcon, nswHazardIcon } from '../../lib/mapIcons'
import { NSW_HAZARD_COLOR, nswHazardHeading, nswHazardLines, type NswHazard } from '../../api/nswHazards'
import { CYCLONE_COLOR, type Cyclone } from '../../api/jtwc'
import { PAST_CYCLONE_COLOR, pastCycloneTitle, type PastCyclone } from '../../api/pastCyclones'
import { brisbaneDayClock as aest } from '../../lib/aest'

// Map sources and layers for NSW border fires and road hazards, JTWC's current
// cyclones and past cyclone tracks. Every point drawn is one the publisher gives; the lines
// only join a storm's own published positions in order.

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function nswFireFeatures(fires: NswFire[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fires.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: f.position },
      properties: { key: `place/nswfire/${encodeURIComponent(f.id)}`, color: NSW_ALERT_COLOR[f.alertLevel] ?? NSW_ALERT_COLOR['Not Applicable'], icon: nswFireIcon(NSW_ALERT_COLOR[f.alertLevel] ? f.alertLevel : 'Not Applicable'), label: `NSW RFS · ${f.alertLevel} · ${f.title}` },
    })),
  }
}

/** Each NSW road hazard's published point, and its published extent as lines. */
export function nswHazardFeatures(hazards: NswHazard[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hazards.flatMap((h) => {
      const key = `place/nswhazard/${encodeURIComponent(h.id)}`
      const label = `Transport for NSW · ${nswHazardHeading(h)}${h.roads[0] ? ` · ${h.roads[0].street}` : ''}`
      const color = h.major ? NSW_HAZARD_COLOR.major : NSW_HAZARD_COLOR.normal
      return [
        ...nswHazardLines(h).map((line) => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: line }, properties: { key, label, color } })),
        { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: h.position }, properties: { key, label, color, icon: nswHazardIcon(h.kind, h.major) } },
      ]
    }),
  }
}

/** Each storm's published track as a line, and each published position as a point labelled with its time. */
export function cycloneFeatures(storms: Cyclone[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: storms.flatMap((c) => {
      const key = `place/cyclone/${encodeURIComponent(c.id)}`
      const name = c.name ? `${c.name} (${c.id})` : c.id
      return [
        { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: c.points.map((p) => p.position) }, properties: { key, label: `JTWC track · ${name}` } },
        ...c.points.map((p) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: p.position },
          properties: { key, now: p.tau === 0 ? 1 : 0, label: `${name} · ${p.tau === 0 ? 'warning position' : 'JTWC forecast'} · ${aest.format(p.validAt)} AEST${p.windKt ? ` · ${p.windKt} kt` : ''}` },
        })),
      ]
    }),
  }
}

export function pastCycloneFeatures(storms: PastCyclone[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: storms.map((c) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: c.points.map((p) => p.position) },
      properties: { key: `place/pastcyclone/${encodeURIComponent(c.id)}`, label: `Past cyclone · ${pastCycloneTitle(c)}` },
    })),
  }
}

/** Adds the sources and layers, hidden until their switches turn them on. */
export function addHazardLayers(map: maplibregl.Map) {
  for (const id of ['nsw-fires', 'nsw-hazards', 'cyclones', 'past-cyclones']) map.addSource(id, { type: 'geojson', data: empty })
  map.addLayer({
    id: 'past-cyclones',
    type: 'line',
    source: 'past-cyclones',
    layout: { visibility: 'none', 'line-cap': 'round' },
    paint: { 'line-color': PAST_CYCLONE_COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 2.5] as never, 'line-opacity': 0.55 },
  })
  map.addLayer({
    id: 'cyclone-track',
    type: 'line',
    source: 'cyclones',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { visibility: 'none' },
    paint: { 'line-color': CYCLONE_COLOR, 'line-width': 2, 'line-dasharray': [2, 1.5] },
  })
  map.addLayer({
    id: 'cyclone-points',
    type: 'circle',
    source: 'cyclones',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['case', ['==', ['get', 'now'], 1], 8, 5] as never,
      'circle-color': ['case', ['==', ['get', 'now'], 1], CYCLONE_COLOR, '#ffffff'] as never,
      'circle-stroke-color': CYCLONE_COLOR,
      'circle-stroke-width': 2,
    },
  })
  // Dashed, unlike QLDTraffic's solid event lines, so a road over the border reads as another state's.
  map.addLayer({
    id: 'nsw-hazard-lines',
    type: 'line',
    source: 'nsw-hazards',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { visibility: 'none', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'] as never, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 14, 5] as never, 'line-dasharray': [2, 1.5], 'line-opacity': 0.85 },
  })
  map.addLayer({
    id: 'nsw-hazards',
    type: 'symbol',
    source: 'nsw-hazards',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: { visibility: 'none', 'icon-image': ['get', 'icon'] as never, 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.65, 12, 0.95] as never, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  })
  map.addLayer({
    id: 'nsw-fires',
    type: 'symbol',
    source: 'nsw-fires',
    layout: { visibility: 'none', 'icon-image': ['get', 'icon'] as never, 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.65, 12, 0.95] as never, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  })
}
