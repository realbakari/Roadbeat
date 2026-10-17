import { SATELLITE_SOURCES, type SatelliteSource } from './satelliteImage'

/**
 * The map's base: the street map, or one satellite image under the labels and
 * overlays. A base, not an overlay, so a satellite image can never stack on
 * another one.
 */
export type MapBase = 'map' | 'satellite'

export function parseBase(v: string | null | undefined): MapBase | null {
  return v === 'map' || v === 'satellite' ? v : null
}

export function parseSatelliteSource(v: string | null | undefined): SatelliteSource | null {
  return SATELLITE_SOURCES.find((s) => s.value === v)?.value ?? null
}
