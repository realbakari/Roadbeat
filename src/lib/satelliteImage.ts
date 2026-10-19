import { HIMAWARI_BANDS, HIMAWARI_CREDIT, himawariTiles, type HimawariBand } from '../api/himawari'
import { JMA_CREDIT, JMA_MAX_ZOOM, JMA_MIN_ZOOM, jmaTiles, type JmaFrame, type JmaProduct } from '../api/jmaHimawari'
import { DAILY_PASSES, GIBS_MAX_ZOOM, gibsTiles, type DailyPass } from '../api/satelliteImagery'
import { QLD_AERIAL_BOUNDS, QLD_AERIAL_CREDIT, QLD_AERIAL_MAX_ZOOM, QLD_AERIAL_TILES } from '../api/qldImagery'

/**
 * The satellite images the map can show, one at a time: Himawari-9 from NASA
 * GIBS (infrared or visible) or from the Japan Meteorological Agency's own map
 * (infrared or true colour), one day's NASA image from NOAA-20 or Terra, or
 * the Queensland Government's aerial photos for detail on the ground.
 */
export type SatelliteSource = HimawariBand | 'jma-infrared' | 'jma-truecolour' | DailyPass | 'qld-aerial'

export const SATELLITE_SOURCES: { value: SatelliteSource; label: string }[] = [
  { value: 'infrared', label: 'Live infrared (Himawari-9, NASA)' },
  { value: 'visible', label: 'Live visible, daytime only (Himawari-9, NASA)' },
  { value: 'jma-infrared', label: 'Live infrared, sooner but coarser (Himawari-9, JMA)' },
  { value: 'jma-truecolour', label: 'Live true colour, daytime only (Himawari-9, JMA)' },
  { value: 'noaa20', label: 'Daily true colour, afternoon pass (NOAA-20)' },
  { value: 'terra', label: 'Daily true colour, morning pass (Terra)' },
  { value: 'qld-aerial', label: 'Aerial photos, 2022 or older (Queensland Government)' },
]

/** The state's aerial photos: a fixed image of the ground, not a picture of today's weather. */
export const isAerial = (s: SatelliteSource) => s === 'qld-aerial'

export function isGibsLive(s: SatelliteSource): s is HimawariBand {
  return s === 'infrared' || s === 'visible'
}
export function jmaProduct(s: SatelliteSource): JmaProduct | null {
  return s === 'jma-infrared' ? 'infrared' : s === 'jma-truecolour' ? 'truecolour' : null
}
export function dailyPass(s: SatelliteSource): DailyPass | null {
  return s === 'noaa20' || s === 'terra' ? s : null
}

/** One raster image for the map: its tile address, the zooms its source serves, and its credit. */
export interface SatelliteTiles {
  tiles: string
  minzoom: number
  maxzoom: number
  attribution: string
  /** The area the source serves (west, south, east, north); no tiles are asked for outside it. */
  bounds?: [number, number, number, number]
  /** Start the map's credit closed behind its button, for a credit too long to cover the map with. */
  collapseCredit?: boolean
}

/**
 * The frame or day to draw from what each source has published: a time GIBS
 * listed, an image JMA listed, and the chosen day. The credit carries no time,
 * so stepping through frames only swaps tiles; the image's time is shown in the
 * layer note and the timeline.
 */
export interface SatelliteFrames {
  gibsTime: string | null
  jmaFrame: JmaFrame | null
  date: string | null
}

/**
 * The single satellite image the map draws, or null when the chosen source
 * has published nothing to draw yet. Only the chosen source is ever drawn, so
 * two images can't stack.
 */
export function satelliteTiles(source: SatelliteSource, f: SatelliteFrames): SatelliteTiles | null {
  if (isAerial(source)) return { tiles: QLD_AERIAL_TILES, minzoom: 0, maxzoom: QLD_AERIAL_MAX_ZOOM, attribution: QLD_AERIAL_CREDIT, bounds: QLD_AERIAL_BOUNDS, collapseCredit: true }
  const pass = dailyPass(source)
  if (pass) return f.date ? { tiles: gibsTiles(f.date, pass), minzoom: 0, maxzoom: GIBS_MAX_ZOOM, attribution: `${DAILY_PASSES[pass].credit}, ${f.date}` } : null
  const product = jmaProduct(source)
  if (product) {
    if (!f.jmaFrame) return null
    return { tiles: jmaTiles(product, f.jmaFrame), minzoom: JMA_MIN_ZOOM, maxzoom: JMA_MAX_ZOOM, attribution: `Himawari-9: ${JMA_CREDIT}` }
  }
  if (!isGibsLive(source) || !f.gibsTime) return null
  return {
    tiles: himawariTiles(source, f.gibsTime),
    minzoom: 0,
    maxzoom: HIMAWARI_BANDS[source].level,
    attribution: HIMAWARI_CREDIT,
  }
}
