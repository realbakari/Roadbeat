import { DEFAULT_LAYERS, type MapLayers } from '../components/map/settings'
import { parseBase, parseSatelliteSource, type MapBase } from './mapBase'
import type { SatelliteSource } from './satelliteImage'

// The map's base and overlays in the address, so a shared link opens the same
// view: ?base=satellite&image=jma-truecolour&layers=fires,warnings,radar.
// Each is written only when it differs from the default, so an untouched map
// keeps a clean address. The #hash stays the selection (#event/123).

export interface MapView {
  base: MapBase
  image: SatelliteSource
  layers: MapLayers
}

const LAYER_KEYS = Object.keys(DEFAULT_LAYERS) as (keyof MapLayers)[]

/** The view a link names. Only what it names is returned; unknown layers and values are dropped. */
export function viewFromSearch(search: string): Partial<MapView> {
  const q = new URLSearchParams(search)
  const out: Partial<MapView> = {}
  const base = parseBase(q.get('base'))
  if (base) out.base = base
  const image = parseSatelliteSource(q.get('image'))
  if (image) out.image = image
  const list = q.get('layers')
  if (list != null) {
    const on = new Set(list.split(',').filter(Boolean))
    out.layers = Object.fromEntries(LAYER_KEYS.map((k) => [k, on.has(k)])) as unknown as MapLayers
  }
  return out
}

/**
 * `search` with the view written into it, other parameters kept. A base of
 * map and an image of infrared are left out, as are the layers when they are
 * the defaults; `layers` lists every layer that is on, in a fixed order.
 */
export function searchWithView(search: string, view: MapView): string {
  const q = new URLSearchParams(search)
  q.delete('base')
  q.delete('image')
  q.delete('layers')
  if (view.base !== 'map') q.set('base', view.base)
  if (view.base === 'satellite' && view.image !== 'infrared') q.set('image', view.image)
  if (LAYER_KEYS.some((k) => view.layers[k] !== DEFAULT_LAYERS[k])) q.set('layers', LAYER_KEYS.filter((k) => view.layers[k]).join(','))
  const s = q.toString().replace(/%2C/g, ',')
  return s ? `?${s}` : ''
}
