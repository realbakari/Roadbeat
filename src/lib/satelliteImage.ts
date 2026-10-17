import { HIMAWARI_BANDS, HIMAWARI_CREDIT, himawariTiles, type HimawariBand } from '../api/himawari'
import { GIBS_CREDIT, GIBS_MAX_ZOOM, gibsTiles } from '../api/satelliteImagery'
import { aestStamp } from './aest'

/** One raster image for the map: its tile address, the zoom its source stops at, and its credit. */
export interface SatelliteTiles {
  tiles: string
  maxzoom: number
  attribution: string
}

/**
 * The single satellite image the map draws, or null when there is none to
 * draw yet: Himawari-9's image at the time GIBS listed (`liveTime`), or NASA's
 * daily image for `date`. Never both, so two images can't stack.
 */
export function satelliteTiles(source: HimawariBand | 'daily', liveTime: string | null, date: string | null): SatelliteTiles | null {
  if (source === 'daily') return date ? { tiles: gibsTiles(date), maxzoom: GIBS_MAX_ZOOM, attribution: `${GIBS_CREDIT}, ${date}` } : null
  if (!liveTime) return null
  return { tiles: himawariTiles(source, liveTime), maxzoom: HIMAWARI_BANDS[source].level, attribution: `${HIMAWARI_CREDIT}, image ${aestStamp(Date.parse(liveTime))}` }
}
