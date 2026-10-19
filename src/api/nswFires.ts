import type { LngLat } from '../lib/geo'
import { decodeEntities } from '../lib/newsText'
import { NSW_BORDER_LAT } from '../lib/nswBorder'

// NSW Rural Fire Service major incidents (the Fires Near Me feed), for fires
// just south of the Queensland border. The feed answers CORS requests. The
// RFS feeds page licenses its material CC BY 4.0 with the attribution below;
// each incident's published fields are shown as written, and linked to Fires
// Near Me for the official, current information.

export const NSW_FIRES_URL = 'https://www.rfs.nsw.gov.au/feeds/majorIncidents.json'
export const NSW_FIRES_PAGE = 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me'
export const NSW_FIRES_ATTRIBUTION = '© State of New South Wales (NSW Rural Fire Service). For current information go to www.rfs.nsw.gov.au'

export { NSW_BORDER_LAT }

export const NSW_ALERT_COLOR: Record<string, string> = {
  'Emergency Warning': '#b91c1c',
  'Watch and Act': '#c2410c',
  Advice: '#a16207',
  'Not Applicable': '#6b7280',
}

export interface NswFire {
  /** The RFS incident id, from its guid. */
  id: string
  title: string
  /** RFS alert level as published: Advice, Watch and Act, Emergency Warning or Not Applicable. */
  alertLevel: string
  position: LngLat
  /** The incident's published fields, in order: ALERT LEVEL, LOCATION, COUNCIL AREA, STATUS, TYPE, FIRE, SIZE, RESPONSIBLE AGENCY, UPDATED. */
  fields: [string, string][]
  /** The feed's pubDate as written (NSW local time, which observes daylight saving). */
  published: string | null
  link: string
}

type Geometry = { type: string; coordinates?: unknown; geometries?: Geometry[] }

/** The incident's published point: the first Point in its geometry. */
function firstPoint(g: Geometry | null | undefined): LngLat | null {
  if (!g) return null
  if (g.type === 'Point' && Array.isArray(g.coordinates)) {
    const [lng, lat] = g.coordinates as number[]
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
  }
  for (const c of g.geometries ?? []) {
    const p = firstPoint(c)
    if (p) return p
  }
  return null
}

/** "ALERT LEVEL: Advice <br />LOCATION: …" → [["Alert level", "Advice"], ["Location", …]]. */
export function parseFields(description: string): [string, string][] {
  return decodeEntities(description)
    .split(/<br\s*\/?>/i)
    .flatMap((part) => {
      const m = /^\s*([A-Z][A-Z ]+):\s*(.*?)\s*$/.exec(part.replace(/<[^>]+>/g, ''))
      if (!m || !m[2]) return []
      const label = m[1].trim().toLowerCase()
      return [[label.charAt(0).toUpperCase() + label.slice(1), m[2]] as [string, string]]
    })
}

interface Feature {
  geometry?: Geometry | null
  properties?: { title?: string; category?: string; guid?: string; pubDate?: string; description?: string; link?: string }
}

/** Incidents near the Queensland border (north of NSW_BORDER_LAT), as the RFS publishes them. */
export function parseNswFires(json: unknown): NswFire[] {
  const features = (json as { features?: Feature[] } | null)?.features
  if (!Array.isArray(features)) return []
  return features.flatMap((f) => {
    const p = f.properties ?? {}
    const position = firstPoint(f.geometry)
    if (!position || position[1] < NSW_BORDER_LAT || !p.title) return []
    const id = /(\d+)\/?$/.exec(p.guid ?? '')?.[1] ?? p.guid ?? p.title
    return [
      {
        id,
        title: p.title,
        alertLevel: p.category?.trim() || 'Not Applicable',
        position,
        fields: parseFields(p.description ?? ''),
        published: p.pubDate?.trim() || null,
        link: p.link || NSW_FIRES_PAGE,
      },
    ]
  })
}

export async function fetchNswFires(signal?: AbortSignal): Promise<NswFire[]> {
  const res = await fetch(NSW_FIRES_URL, { signal })
  if (!res.ok) throw new Error(`NSW RFS responded with ${res.status}`)
  return parseNswFires(await res.json())
}
