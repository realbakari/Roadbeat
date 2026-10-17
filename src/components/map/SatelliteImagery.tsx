import type * as maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { SatelliteTiles } from '../../lib/satelliteImage'

const SOURCE = 'satellite-imagery'

/** The base map's first label layer, so the image sits under place names and roads stay readable on top of it. */
function firstLabelLayer(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
}

function remove(map: maplibregl.Map) {
  if (map.getLayer(SOURCE)) map.removeLayer(SOURCE)
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
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
    remove(map)
    if (!shown || !latestTiles.current) return
    map.addSource(SOURCE, { type: 'raster', tiles: [latestTiles.current], tileSize: 256, minzoom, maxzoom, attribution })
    map.addLayer({ id: SOURCE, type: 'raster', source: SOURCE, paint: { 'raster-opacity': 0.9 } }, firstLabelLayer(map))
    return () => {
      // The style may already be gone when the map itself is being removed.
      if (map.getStyle()) remove(map)
    }
  }, [map, ready, shown, minzoom, maxzoom, attribution])
  useEffect(() => {
    if (!map || !ready || !tiles) return
    ;(map.getSource(SOURCE) as maplibregl.RasterTileSource | undefined)?.setTiles([tiles])
  }, [map, ready, tiles])
  return null
}
