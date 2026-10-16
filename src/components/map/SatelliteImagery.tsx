import type * as maplibregl from 'maplibre-gl'
import { useEffect } from 'react'
import { GIBS_CREDIT, GIBS_MAX_ZOOM, gibsTiles } from '../../api/satelliteImagery'

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
 * NASA's satellite image for one day (`date`, yyyy-mm-dd), drawn over the base
 * map and under its labels and Roadbeat's layers. Null `date` removes it. It is
 * re-added after every style load (`ready`), since a new base map drops it.
 */
export function SatelliteImagery({ map, ready, date }: { map: maplibregl.Map | null; ready: number; date: string | null }) {
  useEffect(() => {
    if (!map || !ready) return
    remove(map)
    if (!date) return
    map.addSource(SOURCE, { type: 'raster', tiles: [gibsTiles(date)], tileSize: 256, maxzoom: GIBS_MAX_ZOOM, attribution: `${GIBS_CREDIT}, ${date}` })
    map.addLayer({ id: SOURCE, type: 'raster', source: SOURCE, paint: { 'raster-opacity': 0.9 } }, firstLabelLayer(map))
    return () => {
      // The style may already be gone when the map itself is being removed.
      if (map.getStyle()) remove(map)
    }
  }, [map, ready, date])
  return null
}
