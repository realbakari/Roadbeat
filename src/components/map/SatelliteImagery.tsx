import type * as maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { SatelliteTiles } from '../../lib/satelliteImage'
import { LABEL_PAINT, coveringFills, imageBeforeLayer, imageFadedZoom, imageOpacity, labelLayers, type StyleLayer } from '../../lib/satelliteStyle'

const SOURCE = 'satellite-imagery'

const styleLayers = (map: maplibregl.Map) => (map.getStyle().layers ?? []) as unknown as StyleLayer[]

/** What was changed in the base map while the image shows, each step putting one layer back. */
type Undo = [layer: string, put: () => void][]

/** Switches the base map's labels to white on a dark outline. */
function brightenLabels(map: maplibregl.Map, undo: Undo) {
  for (const id of labelLayers(styleLayers(map))) {
    for (const [prop, value] of Object.entries(LABEL_PAINT) as [keyof typeof LABEL_PAINT, unknown][]) {
      const own = map.getPaintProperty(id, prop)
      undo.push([id, () => map.setPaintProperty(id, prop, own as never)])
      map.setPaintProperty(id, prop, value as never)
    }
  }
}

/** Keeps the base map's fills that would cover the image hidden until it has faded. */
function holdBackFills(map: maplibregl.Map, before: string | undefined, maxzoom: number, undo: Undo) {
  for (const id of coveringFills(styleLayers(map), before)) {
    const layer = map.getLayer(id)
    if (!layer) continue
    const { minzoom, maxzoom: top } = layer
    undo.push([id, () => map.setLayerZoomRange(id, minzoom, top)])
    map.setLayerZoomRange(id, Math.max(minzoom, imageFadedZoom(maxzoom)), top)
  }
}

function remove(map: maplibregl.Map, undo: Undo) {
  if (map.getLayer(SOURCE)) map.removeLayer(SOURCE)
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
  for (const [id, put] of undo) if (map.getLayer(id)) put()
  undo.length = 0
}

/**
 * Closes the map's compact credit as a drag would. MapLibre opens it when the
 * first credit arrives (on load, from the base map's tile metadata), so if
 * that hasn't happened yet this waits for it. Returns a function that stops waiting.
 */
function collapseCreditOnce(map: maplibregl.Map): () => void {
  const collapse = () => {
    const el = map.getContainer().querySelector('.maplibregl-ctrl-attrib')
    if (!el?.classList.contains('maplibregl-compact')) return false
    el.classList.remove('maplibregl-compact-show')
    return true
  }
  if (collapse()) return () => {}
  const onData = () => {
    if (collapse()) map.off('sourcedata', onData)
  }
  map.on('sourcedata', onData)
  return () => map.off('sourcedata', onData)
}

/**
 * The one satellite image chosen as the map's base, drawn over the base map
 * and under its labels and Roadbeat's layers, with the base map's buildings
 * and airport fills held back until it fades. Null `image` removes it. It is
 * re-added after every style load (`ready`), since a new base map drops it,
 * and when its source or zooms change. Stepping through one source's frames
 * swaps the tile address in place, so the image doesn't blink out between
 * frames. Above `maxzoom` MapLibre stretches the source's last tiles rather
 * than asking for ones it doesn't serve, and below `minzoom` it draws none;
 * outside `bounds` it asks for none.
 */
export function SatelliteImagery({ map, ready, image }: { map: maplibregl.Map | null; ready: number; image: SatelliteTiles | null }) {
  const tiles = image?.tiles ?? null
  const minzoom = image?.minzoom
  const maxzoom = image?.maxzoom
  const attribution = image?.attribution
  const bounds = image?.bounds
  const collapseCredit = image?.collapseCredit ?? false
  const latestTiles = useRef(tiles)
  useEffect(() => {
    latestTiles.current = tiles
  })
  const shown = tiles != null
  useEffect(() => {
    if (!map || !ready) return
    const undo: Undo = []
    remove(map, undo)
    if (!shown || !latestTiles.current) return
    map.addSource(SOURCE, { type: 'raster', tiles: [latestTiles.current], tileSize: 256, minzoom, maxzoom, attribution, bounds })
    const stopCollapse = collapseCredit ? collapseCreditOnce(map) : () => {}
    // Under the roads and names, like a hybrid map; opaque, fading out past the source's sharpest zoom.
    const before = imageBeforeLayer(styleLayers(map))
    map.addLayer({ id: SOURCE, type: 'raster', source: SOURCE, paint: { 'raster-opacity': imageOpacity(maxzoom ?? 9) as never, 'raster-fade-duration': 150 } }, before)
    brightenLabels(map, undo)
    holdBackFills(map, before, maxzoom ?? 9, undo)
    return () => {
      stopCollapse()
      // The style may already be gone when the map itself is being removed.
      if (map.getStyle()) remove(map, undo)
    }
  }, [map, ready, shown, minzoom, maxzoom, attribution, bounds, collapseCredit])
  useEffect(() => {
    if (!map || !ready || !tiles) return
    ;(map.getSource(SOURCE) as maplibregl.RasterTileSource | undefined)?.setTiles([tiles])
  }, [map, ready, tiles])
  return null
}
