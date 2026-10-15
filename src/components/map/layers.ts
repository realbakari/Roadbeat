import type * as maplibregl from 'maplibre-gl'
import type { ColorMode } from '../../hooks/useColorMode'
import { LAYER_COLOR } from '../../lib/mapIcons'
import { addCrashLayers } from './crashLayers'

export const isLine = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]] as never

/**
 * Track line width: a crisp line when zoomed out; from street zoom, a band
 * about 16 m wide on the ground. TransLink's shapes run down the middle of a
 * corridor rather than along each rail (about 2 m off either rail of a double
 * track), so a translucent corridor-wide band shows the line where it really
 * runs, with the base map's individual rails visible through it.
 */
const CORRIDOR_WIDTH = (atZoom7: number, atZoom14: number) =>
  ['interpolate', ['linear'], ['zoom'], 7, atZoom7, 14, atZoom14, 16, 8, 17, 15, 18, 30, 19, 60, 20, 120] as never
const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function addLayers(map: maplibregl.Map, mode: ColorMode) {
  // OpenStreetMap building heights from the base map's own tiles, drawn under our layers.
  if (map.getSource('openmaptiles')) {
    map.addLayer({
      id: 'qldt-buildings-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': mode === 'dark' ? '#3a3f47' : '#d9d6d0',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0] as never,
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] as never,
        'fill-extrusion-opacity': 0.85,
      },
    })
    // Liberty draws its own 3D buildings; ours replaces it so the switch controls both.
    if (map.getLayer('building-3d')) map.removeLayer('building-3d')
  }

  for (const id of ['districts', 'flood-2022', 'fires', 'event-shapes', 'event-markers', 'cameras', 'places', 'trucks', 'clearances', 'clearways', 'council-places', 'council-events', 'news', 'news-roads', 'bikeways', 'tracks', 'stops', 'signals', 'gauges', 'vehicles']) {
    map.addSource(id, { type: 'geojson', data: empty })
  }
  const color = ['get', 'color'] as unknown as string

  map.addLayer({
    id: 'district-fill',
    type: 'fill',
    source: 'districts',
    filter: ['==', ['get', 'district'], ''],
    paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.05 },
  })
  map.addLayer({
    id: 'district-line',
    type: 'line',
    source: 'districts',
    filter: ['==', ['get', 'district'], ''],
    paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 1.5] },
  })
  addCrashLayers(map)
  // February 2022 flood extent, under everything else so live layers stay readable.
  map.addLayer({
    id: 'flood-2022-fill',
    type: 'fill',
    source: 'flood-2022',
    layout: { visibility: 'none' },
    paint: { 'fill-color': LAYER_COLOR.flood2022, 'fill-opacity': 0.2 },
  })
  map.addLayer({
    id: 'flood-2022-line',
    type: 'line',
    source: 'flood-2022',
    layout: { visibility: 'none' },
    paint: { 'line-color': LAYER_COLOR.flood2022, 'line-width': 0.8, 'line-opacity': 0.6 },
  })
  // Bushfire warning areas (shaded in the warning level's colour) under everything else.
  map.addLayer({
    id: 'fire-areas',
    type: 'fill',
    source: 'fires',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]] as never,
    paint: { 'fill-color': color, 'fill-opacity': 0.14 },
  })
  map.addLayer({
    id: 'fire-area-lines',
    type: 'line',
    source: 'fires',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]] as never,
    paint: { 'line-color': color, 'line-width': 1.5, 'line-dasharray': [3, 1.5] },
  })
  map.addLayer({
    id: 'event-areas',
    type: 'fill',
    source: 'event-shapes',
    filter: ['==', ['get', 'area'], true],
    paint: { 'fill-color': color, 'fill-opacity': 0.12, 'fill-outline-color': color },
  })
  map.addLayer({
    id: 'trucks-line',
    type: 'line',
    source: 'trucks',
    filter: isLine,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': LAYER_COLOR.truck,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 5],
      'line-dasharray': [1.5, 1],
    },
  })
  // Clearways: solid red while their signed times cover now, dashed grey otherwise.
  map.addLayer({
    id: 'clearways-off',
    type: 'line',
    source: 'clearways',
    minzoom: 11,
    filter: ['!=', ['get', 'state'], 'on'],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': LAYER_COLOR.clearwayOff, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5], 'line-dasharray': [1.5, 1.2] },
  })
  map.addLayer({
    id: 'clearways-on',
    type: 'line',
    source: 'clearways',
    minzoom: 11,
    filter: ['==', ['get', 'state'], 'on'],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': LAYER_COLOR.clearwayOn, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 6] },
  })
  // Bikeways: separated and off-road paths solid, on-road lanes and routes dashed, shared paths in between.
  map.addLayer({
    id: 'bikeways',
    type: 'line',
    source: 'bikeways',
    minzoom: 11,
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['match', ['get', 'kind'], 'separated', '#15803d', 'shared', '#22c55e', 'lane', '#65a30d', 'route', '#84cc16', '#a3a3a3'] as never,
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 16, ['match', ['get', 'kind'], 'separated', 4, 'shared', 3.5, 3]] as never,
      'line-opacity': ['match', ['get', 'kind'], 'informal', 0.6, 0.9] as never,
    },
  })
  map.addLayer({
    id: 'event-lines-casing',
    type: 'line',
    source: 'event-shapes',
    filter: isLine,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-opacity': 0.9,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 6, 15, 12],
    },
  })
  map.addLayer({
    id: 'event-lines-selected',
    type: 'line',
    source: 'event-shapes',
    filter: ['==', ['get', 'id'], -1],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-opacity': 0.35,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 16, 15, 24],
    },
  })
  map.addLayer({
    id: 'event-lines',
    type: 'line',
    source: 'event-shapes',
    filter: isLine,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-opacity': ['case', ['==', ['get', 'future'], true], 0.5, 1],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 10, 3.5, 15, 8],
    },
  })

  const iconLayer = (id: string, source: string, filter: unknown, minzoom = 0, size = [5, 0.5, 12, 0.8]) =>
    map.addLayer({
      id,
      type: 'symbol',
      source,
      minzoom,
      filter: filter as never,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], ...size] as never,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })

  iconLayer('places-rest', 'places', ['in', ['get', 'icon'], ['literal', ['rest-area', 'rest-area-hv']]], 6)
  iconLayer('places-dump', 'places', ['==', ['get', 'icon'], 'dump-point'], 6)
  iconLayer('trucks-icon', 'trucks', ['==', ['geometry-type'], 'Point'], 7)
  iconLayer('toilets', 'council-places', ['in', ['get', 'icon'], ['literal', ['toilet', 'toilet-accessible']]], 11, [11, 0.55, 16, 0.85])
  iconLayer('parking-meters', 'council-places', ['==', ['get', 'icon'], 'parking-meter'], 13, [13, 0.55, 17, 0.85])
  iconLayer('bike-stops', 'council-places', ['in', ['get', 'icon'], ['literal', ['bike-rack', 'bike-repair']]], 13, [13, 0.5, 17, 0.8])
  iconLayer('accessible-parking', 'council-places', ['==', ['get', 'icon'], 'accessible-parking'], 14, [14, 0.6, 17, 0.85])
  iconLayer('council-events', 'council-events', ['==', ['get', 'icon'], 'council-event'], 9, [9, 0.55, 15, 0.85])
  // Low clearance signs: lower clearances draw on top where two overlap.
  map.addLayer({
    id: 'clearances',
    type: 'symbol',
    source: 'clearances',
    minzoom: 8,
    layout: {
      visibility: 'none',
      'icon-image': ['get', 'icon'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 13, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['-', 10, ['get', 'metres']],
    },
  })
  iconLayer('cameras-web', 'cameras', ['==', ['get', 'icon'], 'camera-webcam'], 7)
  iconLayer('cameras-flood', 'cameras', ['==', ['get', 'icon'], 'camera-floodcam'], 6)
  iconLayer('places-waze', 'places', ['==', ['get', 'icon'], 'waze'], 0, [5, 0.6, 12, 0.85])
  // Fires: warnings drawn above incidents, from the whole-state view.
  map.addLayer({
    id: 'fire-markers',
    type: 'symbol',
    source: 'fires',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 4, ['match', ['get', 'rank'], 3, 0.45, 0.7], 11, ['match', ['get', 'rank'], 3, 0.7, 0.95]] as never,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['-', 10, ['get', 'rank']] as never,
    },
  })

  // Train, tram and ferry tracks (TransLink GTFS shapes): the network faintly with
  // live vehicles, and a shown line or the selected vehicle's route in its colour.
  map.addLayer({
    id: 'tracks-network',
    type: 'line',
    source: 'tracks',
    filter: ['!=', ['get', 'mode'], 'ferry'],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
    paint: {
      'line-color': '#64748b',
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.45, 16, 0.18],
      'line-width': CORRIDOR_WIDTH(1, 3),
    },
  })
  map.addLayer({
    id: 'tracks-line-casing',
    type: 'line',
    source: 'tracks',
    filter: ['==', ['get', 'code'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
    paint: {
      'line-color': '#ffffff',
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 15.5, 0],
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, 4, 14, 9],
    },
  })
  map.addLayer({
    id: 'tracks-line',
    type: 'line',
    source: 'tracks',
    filter: ['==', ['get', 'code'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#2563eb'] as never,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 1, 16, 0.45, 18, 0.3],
      'line-width': CORRIDOR_WIDTH(2.5, 6),
    },
  })

  // Brisbane City Council signals (coloured by measured saturation) and gauges.
  // Signal animation, under the badges: a halo on saturated sites and a ring when a site changes (see useSignalAnimation).
  map.addLayer({
    id: 'signals-halo',
    type: 'circle',
    source: 'signals',
    minzoom: 10,
    filter: ['==', ['get', 'saturated'], true],
    layout: { visibility: 'none' },
    paint: { 'circle-color': '#dc2626', 'circle-opacity': 0, 'circle-radius': 8, 'circle-blur': 0.4 },
  })
  map.addLayer({
    id: 'signals-ring',
    type: 'circle',
    source: 'signals',
    minzoom: 10,
    filter: ['==', ['get', 'changed'], true],
    layout: { visibility: 'none' },
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': 6,
      'circle-stroke-color': '#2563eb',
      'circle-stroke-width': 2,
      'circle-stroke-opacity': 0,
    },
  })
  // Busier signals draw on top, so a red one is never hidden under a green one.
  map.addLayer({
    id: 'signals',
    type: 'symbol',
    source: 'signals',
    minzoom: 10,
    layout: {
      visibility: 'none',
      'icon-image': ['get', 'icon'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 13, 0.55, 16, 0.8],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['get', 'ds'],
    },
  })
  map.addLayer({
    id: 'signals-label',
    type: 'symbol',
    source: 'signals',
    minzoom: 14.5,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'value'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-anchor': 'left',
      'text-offset': [0.9, 0],
      'text-optional': true,
    },
    paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })
  map.addLayer({
    id: 'gauges',
    type: 'circle',
    source: 'gauges',
    minzoom: 8,
    layout: { visibility: 'none' },
    paint: {
      'circle-color': ['match', ['get', 'kind'], 'stream', '#0369a1', '#0d9488'] as never,
      'circle-opacity': ['case', ['get', 'stale'], 0.45, 1] as never,
      'circle-stroke-opacity': ['case', ['get', 'stale'], 0.45, 1] as never,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'kind'], 'stream', 4, 3], 14, ['match', ['get', 'kind'], 'stream', 8, 6]] as never,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'gauges-label',
    type: 'symbol',
    source: 'gauges',
    minzoom: 10.5,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'value'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-anchor': 'left',
      'text-offset': [0.9, 0],
      'text-optional': true,
    },
    paint: { 'text-color': '#0c4a6e', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })

  // TransLink stations and stops: stations as network-map dots, bus stops once zoomed in.
  map.addLayer({
    id: 'stops-bus',
    type: 'circle',
    source: 'stops',
    minzoom: 15,
    filter: ['==', ['get', 'kind'], 'bus'],
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 6],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#64748b',
      'circle-stroke-width': 1.5,
    },
  })
  map.addLayer({
    id: 'stops-station',
    type: 'circle',
    source: 'stops',
    minzoom: 9,
    filter: ['==', ['get', 'kind'], 'station'],
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 13, 5, 16, 7],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#334155',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 2],
    },
  })
  map.addLayer({
    id: 'stops-line',
    type: 'circle',
    source: 'stops',
    filter: ['==', ['get', 'key'], ''],
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 13, 6, 16, 8],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#0f172a',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 14, 2.5],
    },
  })
  const stationName = ['slice', ['get', 'label'], 0, ['-', ['length', ['get', 'label']], ['case', ['==', ['slice', ['get', 'label'], ['-', ['length', ['get', 'label']], 8]], ' station'], 8, 0]]]
  const stopLabel = (id: string, minzoom: number, filter: unknown) =>
    map.addLayer({
      id,
      type: 'symbol',
      source: 'stops',
      minzoom,
      filter: filter as never,
      layout: {
        visibility: 'none',
        'text-field': stationName as never,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 13],
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
        'text-optional': true,
      },
      paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    })
  stopLabel('stops-station-label', 12, ['==', ['get', 'kind'], 'station'])
  stopLabel('stops-line-label', 9, ['==', ['get', 'key'], ''])

  // Live TransLink vehicles: small mode icons, with route numbers once zoomed in.
  map.addLayer({
    id: 'vehicles-selected',
    type: 'circle',
    source: 'vehicles',
    filter: ['==', ['get', 'key'], ''],
    paint: { 'circle-color': '#2563eb', 'circle-opacity': 0.25, 'circle-radius': 18, 'circle-stroke-color': '#2563eb', 'circle-stroke-width': 2 },
  })
  map.addLayer({
    id: 'vehicles',
    type: 'symbol',
    source: 'vehicles',
    minzoom: 8,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 0.7],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['step', ['zoom'], '', 12.5, ['get', 'route']],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-anchor': 'left',
      'text-offset': [0.9, 0],
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })

  map.addLayer({
    id: 'event-markers-selected',
    type: 'circle',
    source: 'event-markers',
    filter: ['==', ['get', 'id'], -1],
    paint: {
      'circle-color': color,
      'circle-opacity': 0.3,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 16, 12, 24],
    },
  })
  // Red Alert/High icons are larger than Medium/Low; higher priority draws on top.
  map.addLayer({
    id: 'event-markers',
    type: 'symbol',
    source: 'event-markers',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        ['match', ['get', 'rank'], 0, 0.75, 1, 0.65, 0.55],
        11,
        ['match', ['get', 'rank'], 0, 1.05, 1, 0.95, 0.85],
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['-', 10, ['get', 'rank']],
    },
  })
  // News monitor pins, above road events so they aren't hidden. News reports are
  // purple rings, official notices solid dark dots, and a place both kinds name is
  // a dark dot with a purple ring. A shared pin shows how many stories it holds.
  map.addLayer({
    id: 'news-roads',
    type: 'line',
    source: 'news-roads',
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['get', 'official'], LAYER_COLOR.newsOfficial, LAYER_COLOR.news] as never,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 6] as never,
      'line-opacity': 0.75,
    },
  })
  map.addLayer({
    id: 'news-roads-selected',
    type: 'line',
    source: 'news-roads',
    filter: ['==', ['get', 'story'], ''],
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': LAYER_COLOR.news, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 16, 14] as never, 'line-opacity': 0.35 },
  })
  const newsRadius = (base: number) => ['+', base, ['*', 1.2, ['min', ['get', 'weight'], 6]]]
  map.addLayer({
    id: 'news-selected',
    type: 'circle',
    source: 'news',
    filter: ['==', ['get', 'name'], ''],
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, newsRadius(10), 12, newsRadius(14)] as never,
      'circle-color': LAYER_COLOR.news,
      'circle-opacity': 0.25,
      'circle-stroke-color': LAYER_COLOR.news,
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'news-pins',
    type: 'circle',
    source: 'news',
    layout: { visibility: 'none', 'circle-sort-key': ['get', 'weight'] as never },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, newsRadius(5), 12, newsRadius(8)] as never,
      'circle-color': ['match', ['get', 'mix'], 0, mode === 'dark' ? '#1f2937' : '#ffffff', LAYER_COLOR.newsOfficial] as never,
      'circle-stroke-color': ['match', ['get', 'mix'], 2, '#ffffff', LAYER_COLOR.news] as never,
      'circle-stroke-width': ['match', ['get', 'mix'], 2, 1.5, 2.5] as never,
    },
  })
  map.addLayer({
    id: 'news-count',
    type: 'symbol',
    source: 'news',
    filter: ['>', ['get', 'count'], 1],
    layout: {
      visibility: 'none',
      'text-field': ['to-string', ['get', 'count']] as never,
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': ['match', ['get', 'mix'], 0, LAYER_COLOR.news, '#ffffff'] as never },
  })
}


export function highlightRing() {
  const el = document.createElement('div')
  el.style.cssText =
    'width:44px;height:44px;border-radius:9999px;border:3px solid #2563eb;background:rgb(37 99 235 / .12);pointer-events:none'
  return el
}

export function youAreHere() {
  const el = document.createElement('div')
  el.style.cssText =
    'width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgb(37 99 235 / .25)'
  el.setAttribute('aria-label', 'Your location')
  return el
}

