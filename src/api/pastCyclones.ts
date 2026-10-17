import type { LngLat } from '../lib/geo'

// Past tropical cyclones that came near Queensland since 1980, built from NOAA
// NCEI's IBTrACS by scripts/build-cyclones.mjs into public/cyclone-tracks.json.
// Only positions an agency reported are in it (IBTrACS's interpolated 3-hourly
// points are dropped). It's history for context, never a current warning;
// recent seasons are provisional.

export const PAST_CYCLONES_URL = '/cyclone-tracks.json'
export const IBTRACS_PAGE = 'https://www.ncei.noaa.gov/products/international-best-track-archive'
export const PAST_CYCLONE_COLOR = '#64748b'
export const IBTRACS_CITATION = 'Knapp et al. (2010), IBTrACS v04r01, NOAA NCEI, doi:10.25921/82ty-9e16'

export interface PastCyclonePoint {
  position: LngLat
  at: number
  /** The WMO agency's wind (usually BoM's 10-minute average), knots, or null where none was reported. */
  windKt: number | null
}

export interface PastCyclone {
  /** IBTrACS's storm id, e.g. "2011028S13180". */
  id: string
  name: string | null
  season: number
  /** The WMO agency for the storm, e.g. "bom". */
  agency: string | null
  peakKt: number | null
  points: PastCyclonePoint[]
}

type Raw = { id: string; name: string | null; season: number; agency: string | null; peakKt: number | null; points: [number, number, number, number | null][] }

export function parsePastCyclones(json: unknown): PastCyclone[] {
  const storms = (json as { storms?: Raw[] } | null)?.storms
  if (!Array.isArray(storms)) return []
  return storms.map((s) => ({
    id: s.id,
    name: s.name,
    season: s.season,
    agency: s.agency,
    peakKt: s.peakKt,
    points: s.points.map(([lng, lat, t, w]) => ({ position: [lng, lat] as LngLat, at: t * 1000, windKt: w })),
  }))
}

/** "Yasi (2011)" or "Unnamed cyclone (2024)". Southern seasons are named by the year they end in, as IBTrACS does. */
export const pastCycloneTitle = (c: PastCyclone) => `${c.name ?? 'Unnamed cyclone'} (${c.season})`

export async function fetchPastCyclones(signal?: AbortSignal): Promise<PastCyclone[]> {
  const res = await fetch(PAST_CYCLONES_URL, { signal })
  if (!res.ok) throw new Error(`The cyclone history file responded with ${res.status}`)
  return parsePastCyclones(await res.json())
}
