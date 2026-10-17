import type * as maplibregl from 'maplibre-gl'
import { useEffect } from 'react'
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
 * The one satellite image chosen in the layers panel (Himawari-9 or NASA's
 * daily image), drawn over the base map and under its labels and Roadbeat's
 * layers. Null `image` removes it. It is re-added after every style load
 * (`ready`), since a new base map drops it. Above `maxzoom` MapLibre stretches
 * the source's last tiles rather than asking for ones it doesn't serve, and
 * below `minzoom` it draws none.
 */
export function SatelliteImagery({ map, ready, image }: { map: maplibregl.Map | null; ready: number; image: SatelliteTiles | null }) {
  const tiles = image?.tiles
  const minzoom = image?.minzoom
  const maxzoom = image?.maxzoom
  const attribution = image?.attribution
  useEffect(() => {
    if (!map || !ready) return
    remove(map)
    if (!tiles) return
    map.addSource(SOURCE, { type: 'raster', tiles: [tiles], tileSize: 256, minzoom, maxzoom, attribution })
    map.addLayer({ id: SOURCE, type: 'raster', source: SOURCE, paint: { 'raster-opacity': 0.9 } }, firstLabelLayer(map))
    return () => {
      // The style may already be gone when the map itself is being removed.
      if (map.getStyle()) remove(map)
    }
  }, [map, ready, tiles, minzoom, maxzoom, attribution])
  return null
}
