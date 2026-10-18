import type * as maplibregl from 'maplibre-gl'
import { useEffect } from 'react'
import { setData } from './features'

/** Keeps a GeoJSON source's data current, and pushes it again after each style reload (`ready` bumps). */
export function useSourceData(map: maplibregl.Map | null, ready: number, id: string, data: GeoJSON.FeatureCollection) {
  useEffect(() => {
    if (ready && map) setData(map, id, data)
  }, [map, ready, id, data])
}
