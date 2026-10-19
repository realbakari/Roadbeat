import type * as maplibregl from 'maplibre-gl'
import { FUEL_STATUS_LABEL, type FuelStation } from '../../api/fuelStations'
import { brandedName, isFresh, priceLabel } from '../../lib/fuelBrands'
import type { ColorMode } from '../../hooks/useColorMode'

// Service stations at their published points. With no fuel chosen, or zoomed
// out past a city, each has the icon for its reported fuels. Zoomed in with a
// fuel chosen, a station that reports it becomes a price pin: a pill whose tail
// points at the station, with the price set like a fuel board (whole cents
// full size, the tenth smaller). Three looks, each with its own shape as well
// as colour: plain for a price, solid green with a heavier rim for the lowest
// in view, a dashed outline reading "Out" when the fuel's reported unavailable.

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const RANK = { unavailable: 3, partial: 2, unknown: 1, available: 0 } as const

/** The zoom from which prices show as pins; below it the stations stay as icons, so a state-wide view isn't a wall of numbers. */
export const PIN_ZOOM = 10.5

type Pin = 'fuel-pin' | 'fuel-pin-cheap' | 'fuel-pin-out'

/**
 * The stations as map features. `labelFuel` names the fuel whose price makes
 * the pin ('' for none); `cheapest` holds the ids at the lowest price in view.
 */
export function fuelFeatures(stations: FuelStation[], labelFuel = '', cheapest: Set<string> = new Set(), now = Date.now()): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map((s) => {
      const price = labelFuel ? priceLabel(s, labelFuel) : null
      const reported = labelFuel ? s.fuels.find((f) => f.name === labelFuel)?.reportedAt : undefined
      const pin: Pin | '' = price == null ? '' : price === 'Out' ? 'fuel-pin-out' : cheapest.has(s.id) ? 'fuel-pin-cheap' : 'fuel-pin'
      const [whole, tenth] = price && price !== 'Out' ? price.split('.') : [price ?? '', '']
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: s.position },
        properties: {
          key: `place/fuel/${encodeURIComponent(s.id)}`,
          icon: `fuel-${s.status}`,
          // Cheapest first, so collisions drop dearer pins, never the cheapest.
          rank: pin === 'fuel-pin-cheap' ? 10 : RANK[s.status],
          label: `${brandedName(s)} · ${price ? `${labelFuel} ${price === 'Out' ? 'unavailable' : price}${pin === 'fuel-pin-cheap' ? ', cheapest in view' : ''}` : FUEL_STATUS_LABEL[s.status]}`,
          pin,
          whole,
          tenth: tenth ? `.${tenth}` : '',
          // A station without the chosen fuel shrinks once pins show, so the prices lead.
          minor: labelFuel && !pin ? 1 : 0,
          // A price older than FRESH_DAYS is faded; its page says how old.
          old: reported != null && !isFresh(reported, now) ? 1 : 0,
        },
      }
    }),
  }
}

/** Each pin's colours in each theme: fill, rim and its width, whether the rim is dashed. */
export const PINS: Record<Pin, Record<ColorMode, { fill: string; rim: string; width: number; dashed?: boolean }>> = {
  'fuel-pin': { light: { fill: '#ffffff', rim: '#475569', width: 1.5 }, dark: { fill: '#1e293b', rim: '#94a3b8', width: 1.5 } },
  'fuel-pin-cheap': { light: { fill: '#15803d', rim: '#14532d', width: 2.5 }, dark: { fill: '#16a34a', rim: '#dcfce7', width: 2.5 } },
  'fuel-pin-out': { light: { fill: '#f8fafc', rim: '#b91c1c', width: 1.5, dashed: true }, dark: { fill: '#1e293b', rim: '#f87171', width: 1.5, dashed: true } },
}

/** Text colour for each pin, per theme. */
const INK: Record<ColorMode, Record<Pin, string>> = {
  light: { 'fuel-pin': '#0f172a', 'fuel-pin-cheap': '#ffffff', 'fuel-pin-out': '#991b1b' },
  dark: { 'fuel-pin': '#f1f5f9', 'fuel-pin-cheap': '#ffffff', 'fuel-pin-out': '#fecaca' },
}

// The pin image, in device pixels at pixelRatio 2: a 40-wide pill body 30 tall, and a tail 10 tall below it.
const W = 40
const BODY = 30
const TAIL = 10

/** A pill with a tail, drawn on a canvas; only its straight middle stretches around the price (MapLibre's icon-text-fit). */
function pinImage(fill: string, rim: string, width: number, dashed = false): { width: number; height: number; data: Uint8ClampedArray } | null {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = BODY + TAIL
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const i = width
  const r = (BODY - i * 2) / 2
  const mid = W / 2
  // One outline: the pill, then down to the tail's tip and back.
  ctx.beginPath()
  ctx.moveTo(i + r, i)
  ctx.lineTo(W - i - r, i)
  ctx.arc(W - i - r, i + r, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(mid + 5, BODY - i)
  ctx.lineTo(mid, BODY + TAIL - i)
  ctx.lineTo(mid - 5, BODY - i)
  ctx.lineTo(i + r, BODY - i)
  ctx.arc(i + r, i + r, r, Math.PI / 2, (Math.PI * 3) / 2)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = width
  ctx.strokeStyle = rim
  if (dashed) ctx.setLineDash([4, 3])
  ctx.lineJoin = 'round'
  ctx.stroke()
  return { width: W, height: BODY + TAIL, data: ctx.getImageData(0, 0, W, BODY + TAIL).data }
}

/** Adds the source, pin images and layers for the current theme, hidden until the switch turns them on. */
export function addFuelLayers(map: maplibregl.Map, mode: ColorMode) {
  for (const [id, themes] of Object.entries(PINS)) {
    const t = themes[mode]
    const img = pinImage(t.fill, t.rim, t.width, t.dashed)
    if (!img) continue
    // A theme change swaps the style; replace the image so the pins follow it.
    if (map.hasImage(id)) map.removeImage(id)
    // Stretch only between the rounded ends, and only the body's middle rows, never the tail.
    map.addImage(id, img, { pixelRatio: 2, stretchX: [[14, 15], [25, 26]], stretchY: [[14, 16]], content: [12, 6, 28, 24] })
  }
  map.addSource('fuel', { type: 'geojson', data: empty })
  map.addLayer({
    id: 'fuel',
    type: 'symbol',
    source: 'fuel',
    // Icons for every station zoomed out, and for stations without a pin once pins show.
    filter: ['any', ['==', ['get', 'pin'], ''], ['<', ['zoom'], PIN_ZOOM]] as never,
    layout: {
      visibility: 'none',
      'icon-image': ['get', 'icon'] as never,
      // Zoom has to lead the expression, so each stop picks the size for a minor station itself.
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.45, PIN_ZOOM - 0.01, 0.7, PIN_ZOOM, ['case', ['==', ['get', 'minor'], 1], 0.45, 0.7], 14, ['case', ['==', ['get', 'minor'], 1], 0.55, 0.85]] as never,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-sort-key': ['get', 'rank'] as never,
    },
  })
  // Pins collide: when they would overlap, the dearer ones give way.
  map.addLayer({
    id: 'fuel-prices',
    type: 'symbol',
    source: 'fuel',
    minzoom: PIN_ZOOM,
    filter: ['!=', ['get', 'pin'], ''],
    layout: {
      visibility: 'none',
      'icon-image': ['get', 'pin'] as never,
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [1, 3, 1, 3],
      // The tail's tip sits on the station: the text box sits above the point by the tail's height.
      'text-anchor': 'bottom',
      'text-offset': [0, -0.75],
      'text-field': ['format', ['get', 'whole'], {}, ['get', 'tenth'], { 'font-scale': 0.78 }] as never,
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], PIN_ZOOM, 12, 15, 14] as never,
      'text-letter-spacing': 0.02,
      'symbol-sort-key': ['-', 0, ['get', 'rank']] as never,
      'text-padding': 2,
    },
    paint: {
      'icon-opacity': ['case', ['==', ['get', 'old'], 1], 0.5, 1] as never,
      'text-opacity': ['case', ['==', ['get', 'old'], 1], 0.6, 1] as never,
      'text-color': ['match', ['get', 'pin'], 'fuel-pin-cheap', INK[mode]['fuel-pin-cheap'], 'fuel-pin-out', INK[mode]['fuel-pin-out'], INK[mode]['fuel-pin']] as never,
    },
  })
}
