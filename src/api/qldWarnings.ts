import { FIRE_BADGE, FIRE_COLOR } from './bushfires'
import { parseQldWarnings, WARNING_LEVELS, type QldWarning, type WarningLevel } from './qldWarningsFeed'

export { issuedFromTitle, parsePolygonCoords, parseQldWarnings, warningLevel, WARNING_LEVELS, type QldWarning, type WarningLevel } from './qldWarningsFeed'

// Queensland's Severe Weather, Flood and Cyclone warnings (and other hazards
// issued under the Australian Warning System), as published on
// disaster.qld.gov.au by Queensland Disaster Management (CC BY 4.0). The S3
// feed sends no CORS headers, so the app reads it through /qld-warnings (see
// vite.config.ts, vercel.json and functions/qld-warnings.ts). Every field is
// shown as published. The feed's ModifiedDate and last_edited_date are when
// the feed was regenerated, not when a warning was issued, so they're not
// used; the issue time is the one written in the warning's title. The
// created_user and last_edited_user fields are never read.

const URL_ = import.meta.env.VITE_QLD_WARNINGS_URL ?? '/qld-warnings'
export const QLD_WARNINGS_PAGE = 'https://www.disaster.qld.gov.au/current-warnings'

/** The warning system's colours, the same as the bushfire layer's, and grey for a level it doesn't name. */
export const WARNING_COLOR: Record<WarningLevel, string> = {
  'Emergency Warning': FIRE_COLOR['Emergency Warning'],
  'Watch and Act': FIRE_COLOR['Watch and Act'],
  Advice: FIRE_COLOR.Advice,
  Other: FIRE_COLOR.Information,
}
export const WARNING_BADGE: Record<WarningLevel, string> = {
  'Emergency Warning': FIRE_BADGE['Emergency Warning'],
  'Watch and Act': FIRE_BADGE['Watch and Act'],
  Advice: FIRE_BADGE.Advice,
  Other: FIRE_BADGE.Information,
}


export async function fetchQldWarnings(signal?: AbortSignal): Promise<QldWarning[]> {
  const res = await fetch(URL_, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Queensland warnings feed responded with ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Warnings feed proxy is not configured')
  return parseQldWarnings(await res.json())
}

/** The map's warning areas and markers, each opening the warning's page (#place/warning/<id>), coloured by the published level only. */
export function warningFeatures(warnings: QldWarning[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const w of warnings) {
    const properties = {
      key: `place/warning/${encodeURIComponent(w.id)}`,
      color: WARNING_COLOR[w.level],
      rank: WARNING_LEVELS.length - 1 - WARNING_LEVELS.indexOf(w.level),
      label: `${w.levelText} · ${w.area ?? w.title}`,
    }
    if (w.areaShape) features.push({ type: 'Feature', geometry: w.areaShape, properties })
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: w.position }, properties })
  }
  return { type: 'FeatureCollection', features }
}
