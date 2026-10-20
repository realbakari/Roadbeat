import { z } from 'zod'

// Queensland Disaster Management's warnings feed, parsed: the part of
// qldWarnings.ts the server also reads (for share cards), so it has no
// browser-only code. See qldWarnings.ts for the feed's terms and fields.

/** The published feed. Browsers read it through /qld-warnings, since it sends no CORS headers. */
export const QLD_WARNINGS_FEED = 'https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json'

type LngLat = [number, number]

/** Australian Warning System levels, highest first; 'Other' is any level the feed names that isn't one of them. */
export const WARNING_LEVELS = ['Emergency Warning', 'Watch and Act', 'Advice', 'Other'] as const
export type WarningLevel = (typeof WARNING_LEVELS)[number]

export interface QldWarning {
  id: string
  level: WarningLevel
  /** WarningLevel as published, e.g. "Advice". */
  levelText: string
  /** WarningTitle, e.g. "ADVICE - STAY INFORMED - Isisford … - Issued at 10:00am, Friday 16 October 2026." */
  title: string
  /** "Issued at 10:00am, Friday 16 October 2026", as the title writes it, or null when it doesn't. */
  issued: string | null
  /** WarningType: "Flood", "Storm", "Cyclone", "Other"… */
  type: string | null
  area: string | null
  /** Who issued it, e.g. "Longreach Regional Council". */
  from: string | null
  callToAction: string | null
  header: string | null
  impacts: string | null
  shouldDo: string | null
  moreInformation: string | null
  /** NextUpdate as published: "Monday 19 October 2026", "As the situation changes." */
  nextUpdate: string | null
  position: LngLat
  /** The warning area from PolygonCoords, or null when it has none the app can read. */
  areaShape: GeoJSON.MultiPolygon | null
}
const field = z.union([z.string(), z.number()]).nullish()
const FeedFeature = z.object({
  geometry: z
    .object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]).rest(z.number()) })
    .nullish()
    .catch(null),
  properties: z.object({
    UniqueID: field,
    GlobalID: field,
    WarningTitle: field,
    WarningLevel: field,
    WarningType: field,
    WarningArea: field,
    Warningfrom: field,
    CallToAction: field,
    Header: field,
    Impacts: field,
    ShouldDo: field,
    MoreInformation: field,
    NextUpdate: field,
    PolygonCoords: field,
  }),
})
const Feed = z.object({ features: z.array(z.unknown()) })

const text = (v: string | number | null | undefined) => {
  if (v == null) return null
  const s = String(v).replace(/\r\n/g, '\n').trim()
  return s || null
}

/** The published level, matched to the warning system's three levels by name only. */
export function warningLevel(raw: string): WarningLevel {
  const s = raw.trim().toLowerCase()
  if (s === 'emergency warning' || s === 'emergency') return 'Emergency Warning'
  if (s === 'watch and act') return 'Watch and Act'
  if (s === 'advice') return 'Advice'
  return 'Other'
}

/** "Issued at 10:00am, Friday 16 October 2026" from a warning's title, as written there. */
export function issuedFromTitle(title: string): string | null {
  return /Issued at [^\n]*?(?=\.?\s*$)/i.exec(title)?.[0] ?? null
}

/**
 * The warning area from PolygonCoords ("lat,lon lat,lon …"). A ring ends where
 * it returns to its first point; a string holding several closed rings is read
 * as several areas. Null when any pair can't be read or a ring isn't closed, so
 * the map never draws a shape the feed didn't give.
 */
export function parsePolygonCoords(raw: string | null): GeoJSON.MultiPolygon | null {
  if (!raw) return null
  const rings: LngLat[][] = []
  let ring: LngLat[] = []
  for (const pair of raw.trim().split(/\s+/)) {
    const [lat, lon, extra] = pair.split(',').map(Number)
    if (extra !== undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
    const p: LngLat = [lon, lat]
    ring.push(p)
    if (ring.length >= 4 && p[0] === ring[0][0] && p[1] === ring[0][1]) {
      rings.push(ring)
      ring = []
    }
  }
  if (ring.length || !rings.length) return null
  return { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) }
}

function warningRank(w: QldWarning) {
  return WARNING_LEVELS.indexOf(w.level)
}

/** Turns the raw feed into warnings, highest level first. Items without an id or a position are skipped rather than shown half-filled. */
export function parseQldWarnings(json: unknown): QldWarning[] {
  const out: QldWarning[] = []
  for (const raw of Feed.parse(json).features) {
    const parsed = FeedFeature.safeParse(raw)
    if (!parsed.success) continue
    const { geometry: g, properties: p } = parsed.data
    const id = text(p.UniqueID) ?? text(p.GlobalID)
    const areaShape = parsePolygonCoords(text(p.PolygonCoords))
    const first = areaShape?.coordinates[0][0][0]
    const position: LngLat | null = g ? [g.coordinates[0], g.coordinates[1]] : first ? [first[0], first[1]] : null
    if (!id || !position) continue
    const levelText = text(p.WarningLevel) ?? 'Not published'
    const title = text(p.WarningTitle) ?? text(p.WarningArea) ?? 'Warning'
    out.push({
      id,
      level: warningLevel(levelText),
      levelText,
      title,
      issued: issuedFromTitle(title),
      type: text(p.WarningType),
      area: text(p.WarningArea),
      from: text(p.Warningfrom),
      callToAction: text(p.CallToAction),
      header: text(p.Header),
      impacts: text(p.Impacts),
      shouldDo: text(p.ShouldDo),
      moreInformation: text(p.MoreInformation),
      nextUpdate: text(p.NextUpdate),
      position,
      areaShape,
    })
  }
  return out.sort((a, b) => warningRank(a) - warningRank(b) || a.title.localeCompare(b.title))
}
