import type { LngLat } from '../lib/geo'

// Tropical cyclone warnings from the US Joint Typhoon Warning Center (JTWC).
// Its RSS feed links each active storm's products; the JMV 3.0 ".tcw" file
// holds the warning position and JTWC's forecast positions and winds. Both
// answer CORS requests. JTWC is not the official warning centre for
// Queensland: the Bureau of Meteorology is, so every view of this data says so
// and links to BoM.

export const JTWC_RSS = 'https://www.metoc.navy.mil/jtwc/rss/jtwc.rss'
export const JTWC_PAGE = 'https://www.metoc.navy.mil/jtwc/jtwc.html'
export const BOM_CYCLONES = 'https://www.bom.gov.au/cyclone/'
export const CYCLONE_COLOR = '#7c3aed'

/**
 * The Australian region the Bureau of Meteorology warns for (90° to 160° E,
 * 0° to 40° S), widened to 170° E for the Coral Sea's eastern edge. A storm is
 * kept when its warning position or any forecast position falls in it.
 */
const REGION = { west: 90, east: 170, north: 0, south: -40 }

export interface CyclonePoint {
  /** Hours after the warning time: 0 is the warning position, the rest are JTWC's forecast. */
  tau: number
  position: LngLat
  /** The time the position is for, ms since the epoch. */
  validAt: number
  /** Maximum sustained wind (one-minute average), knots, as JTWC publishes it. */
  windKt: number | null
}

export interface Cyclone {
  /** JTWC's storm id, e.g. "01P". */
  id: string
  name: string | null
  /** The warning number, e.g. 3. */
  warning: number | null
  /** The warning's time, ms since the epoch. */
  issuedAt: number
  points: CyclonePoint[]
  /** JTWC's warning text for the storm. */
  textUrl: string
  /** The .tcw file the track came from. */
  dataUrl: string
}

/** Every .tcw link in the RSS feed: one per storm JTWC is warning on. */
export function tcwLinks(rss: string): string[] {
  return [...new Set([...rss.matchAll(/https:\/\/www\.metoc\.navy\.mil\/jtwc\/products\/[a-z]{2}\d{4}\.tcw/g)].map((m) => m[0]))]
}

/** "132S" → -13.2, "1632W" → -163.2 (tenths of a degree, with a hemisphere letter). */
function coord(s: string): number | null {
  const m = /^(\d+)([NSEW])$/.exec(s)
  if (!m) return null
  const v = Number(m[1]) / 10
  return m[2] === 'S' || m[2] === 'W' ? -v : v
}

/** "2026101706" (YYYYMMDDHH, UTC) → ms. */
function synoptic(s: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(s)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4]) : null
}

/** One storm from its JMV 3.0 .tcw text, or null when the file can't be read. */
export function parseTcw(text: string, dataUrl: string): Cyclone | null {
  const lines = text.split(/\r?\n/)
  const head = lines.find((l) => /^\d{10}\s+\d{2}[A-Z]\s/.test(l))
  if (!head) return null
  const [time, id, maybeName, maybeWarning] = head.trim().split(/\s+/)
  const issuedAt = synoptic(time)
  if (issuedAt == null) return null
  const named = !/^\d+$/.test(maybeName ?? '')
  const name = named ? maybeName : null
  const warning = Number(named ? maybeWarning : maybeName)
  const points = lines.flatMap((l) => {
    const m = /^T(\d{3})\s+(\d+[NS])\s+(\d+[EW])\s+(\d{3})/.exec(l)
    if (!m) return []
    const lat = coord(m[2])
    const lng = coord(m[3])
    if (lat == null || lng == null) return []
    const tau = Number(m[1])
    return [{ tau, position: [lng, lat] as LngLat, validAt: issuedAt + tau * 3_600_000, windKt: Number(m[4]) || null }]
  })
  if (!points.length) return null
  return {
    id,
    name: name ? name.charAt(0) + name.slice(1).toLowerCase() : null,
    warning: Number.isFinite(warning) ? warning : null,
    issuedAt,
    points,
    textUrl: dataUrl.replace(/\.tcw$/, 'web.txt'),
    dataUrl,
  }
}

const inRegion = ([lng, lat]: LngLat) => lng >= REGION.west && lng <= REGION.east && lat <= REGION.north && lat >= REGION.south

/** Storms with any published position in the Australian region. */
export const nearAustralia = (c: Cyclone) => c.points.some((p) => inRegion(p.position))

export async function fetchCyclones(signal?: AbortSignal): Promise<Cyclone[]> {
  const res = await fetch(JTWC_RSS, { signal })
  if (!res.ok) throw new Error(`JTWC responded with ${res.status}`)
  const links = tcwLinks(await res.text())
  const storms = await Promise.all(
    links.map(async (url) => {
      const r = await fetch(url, { signal })
      // A storm JTWC has stopped warning on answers 403 (a missing S3 object).
      return r.ok ? parseTcw(await r.text(), url) : null
    }),
  )
  return storms.filter((s): s is Cyclone => s != null && nearAustralia(s))
}
