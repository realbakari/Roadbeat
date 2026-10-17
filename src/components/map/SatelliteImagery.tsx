import type * as maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { SatelliteTiles } from '../../lib/satelliteImage'
import { LABEL_PAINT, imageBeforeLayer, imageOpacity, labelLayers, type StyleLayer } from '../../lib/satelliteStyle'

const SOURCE = 'satellite-imagery'

const styleLayers = (map: maplibregl.Map) => (map.getStyle().layers ?? []) as unknown as StyleLayer[]

type Saved = [layer: string, prop: keyof typeof LABEL_PAINT, value: unknown][]

/** Switches the base map's labels to white on a dark outline, returning their own paint to put back. */
function brightenLabels(map: maplibregl.Map): Saved {
  const saved: Saved = []
  for (const id of labelLayers(styleLayers(map))) {
    for (const [prop, value] of Object.entries(LABEL_PAINT) as [keyof typeof LABEL_PAINT, unknown][]) {
      saved.push([id, prop, map.getPaintProperty(id, prop)])
      map.setPaintProperty(id, prop, value as never)
    }
  }
  return saved
}

function remove(map: maplibregl.Map, saved: Saved) {
  if (map.getLayer(SOURCE)) map.removeLayer(SOURCE)
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
  for (const [id, prop, value] of saved) if (map.getLayer(id)) map.setPaintProperty(id, prop, value as never)
  saved.length = 0
}

/**
 * The one satellite image chosen as the map's base, drawn over the base map
 * and under its labels and Roadbeat's layers. Null `image` removes it. It is
 * re-added after every style load (`ready`), since a new base map drops it,
 * and when its source or zooms change. Stepping through one source's frames
 * swaps the tile address in place, so the image doesn't blink out between
 * frames. Above `maxzoom` MapLibre stretches the source's last tiles rather
 * than asking for ones it doesn't serve, and below `minzoom` it draws none.
 */
export function SatelliteImagery({ map, ready, image }: { map: maplibregl.Map | null; ready: number; image: SatelliteTiles | null }) {
  const tiles = image?.tiles ?? null
  const minzoom = image?.minzoom
  const maxzoom = image?.maxzoom
  const attribution = image?.attribution
  const latestTiles = useRef(tiles)
  useEffect(() => {
    latestTiles.current = tiles
  })
  const shown = tiles != null
  useEffect(() => {
    if (!map || !ready) return
    const saved: Saved = []
    remove(map, saved)
    if (!shown || !latestTiles.current) return
    map.addSource(SOURCE, { type: 'raster', tiles: [latestTiles.current], tileSize: 256, minzoom, maxzoom, attribution })
    // Under the roads and names, like a hybrid map; opaque, fading out past the source's sharpest zoom.
    map.addLayer(
      { id: SOURCE, type: 'raster', source: SOURCE, paint: { 'raster-opacity': imageOpacity(maxzoom ?? 9) as never, 'raster-fade-duration': 150 } },
      imageBeforeLayer(styleLayers(map)),
    )
    saved.push(...brightenLabels(map))
    return () => {
      // The style may already be gone when the map itself is being removed.
      if (map.getStyle()) remove(map, saved)
    }
  }, [map, ready, shown, minzoom, maxzoom, attribution])
  useEffect(() => {
    if (!map || !ready || !tiles) return
    ;(map.getSource(SOURCE) as maplibregl.RasterTileSource | undefined)?.setTiles([tiles])
  }, [map, ready, tiles])
  return null
}
