import { z } from 'zod'
import type { LngLat } from '../lib/geo'

// Queensland Fire Department current bushfire incidents and warnings
// (data.qld.gov.au "Queensland Fire Department current bushfire incidents",
// CC BY 4.0), read through /qfd-bushfires (see vite.config.ts and
// functions/qfd-bushfires). Every field is shown as QFD publishes it.

const URL_ = import.meta.env.VITE_QFD_BUSHFIRES_URL ?? '/qfd-bushfires'

/**
 * Australian Warning System levels, highest first. "Information" items are fire
 * incidents QFD reports without a warning.
 */
export const FIRE_LEVELS = ['Emergency Warning', 'Watch and Act', 'Advice', 'Information'] as const
export type FireLevel = (typeof FIRE_LEVELS)[number]

/** The warning system's own colours (red, orange, yellow), and grey for incidents. */
export const FIRE_COLOR: Record<FireLevel, string> = {
  'Emergency Warning': '#d6001c',
  'Watch and Act': '#ff7900',
  Advice: '#e8b400',
  Information: '#6b7280',
}

export interface FireWarning {
  id: string
  level: FireLevel
  /** Level as published, e.g. "Advice", kept in case QFD adds a new one. */
  levelText: string
  title: string
  area: string | null
  location: string | null
  /** Incident status, e.g. "Going", "Contained", when QFD gives one. */
  status: string | null
  /** "FIRE VEGETATION", "FIRE PERMITTED BURN". */
  kind: string | null
  callToAction: string | null
  header: string | null
  impacts: string | null
  shouldDo: string | null
  leaveSafely: string | null
  further: string | null
  text: string | null
  position: LngLat
  /** Warning area, for warnings that have one. */
  areaShape: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  /** When the incident or warning was issued, published in this feed, and when it expires (ms). */
  issued: number | null
  published: number | null
  expires: number | null
}

// The feed's fields, as QFD publishes them. Every field is optional or
// nullable because QFD omits fields that don't apply (incidents carry no
// warning text; warnings carry no incident status).
const field = z.union([z.string(), z.number()]).nullish()
const FeedFeature = z.object({
  geometry: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]).rest(z.number()) }),
      z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(z.array(z.number()))) }),
      z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(z.array(z.array(z.number())))) }),
    ])
    .nullish()
    .catch(null),
  properties: z.object({
    UniqueID: field,
    OBJECTID: field,
    WarningLevel: field,
    WarningTitle: field,
    WarningArea: field,
    Location: field,
    CurrentStatus: field,
    GroupedType: field,
    CallToAction: field,
    Header: field,
    Impacts: field,
    ShouldDo: field,
    LeaveSafely: field,
    FurtherInformation: field,
    WarningText: field,
    Latitude: field,
    Longitude: field,
    ItemDateTimeLocal_ISO: field,
    PublishDateLocal_ISO: field,
    ItemExpiryDateTimeLocal_ISO: field,
  }),
})
const Feed = z.object({ features: z.array(z.unknown()) })

const text = (v: string | number | null | undefined) => {
  if (v == null) return null
  const s = String(v).replace(/\r\n/g, '\n').trim()
  return s || null
}
const time = (v: string | number | null | undefined) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

function levelOf(raw: string): FireLevel {
  const s = raw.toLowerCase()
  if (s.includes('emergency')) return 'Emergency Warning'
  if (s.includes('watch')) return 'Watch and Act'
  if (s.includes('advice')) return 'Advice'
  return 'Information'
}

export function fireRank(f: FireWarning) {
  return FIRE_LEVELS.indexOf(f.level)
}

/**
 * Turns the raw feed into warnings, highest level first, then newest. Items
 * that don't match the schema or have no location are skipped rather than
 * shown half-filled.
 */
export function parseBushfires(json: unknown): FireWarning[] {
  const out: FireWarning[] = []
  for (const raw of Feed.parse(json).features) {
    const parsed = FeedFeature.safeParse(raw)
    if (!parsed.success) continue
    const { geometry: g, properties: p } = parsed.data
    const lat = Number(p.Latitude)
    const lng = Number(p.Longitude)
    const position: LngLat | null =
      Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0
        ? [lng, lat]
        : g?.type === 'Point'
          ? [g.coordinates[0], g.coordinates[1]]
          : null
    if (!position) continue
    const levelText = text(p.WarningLevel) ?? 'Information'
    out.push({
      id: String(p.UniqueID ?? p.OBJECTID),
      level: levelOf(levelText),
      levelText,
      title: text(p.WarningTitle) ?? 'Bushfire',
      area: text(p.WarningArea),
      location: text(p.Location),
      status: text(p.CurrentStatus),
      kind: text(p.GroupedType),
      callToAction: text(p.CallToAction),
      header: text(p.Header),
      impacts: text(p.Impacts),
      shouldDo: text(p.ShouldDo),
      leaveSafely: text(p.LeaveSafely),
      further: text(p.FurtherInformation),
      text: text(p.WarningText),
      position,
      areaShape: g && g.type !== 'Point' ? g : null,
      issued: time(p.ItemDateTimeLocal_ISO),
      published: time(p.PublishDateLocal_ISO),
      expires: time(p.ItemExpiryDateTimeLocal_ISO),
    })
  }
  return out.sort((a, b) => fireRank(a) - fireRank(b) || (b.issued ?? 0) - (a.issued ?? 0))
}

export async function fetchBushfires(signal?: AbortSignal): Promise<FireWarning[]> {
  const res = await fetch(URL_, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Queensland Fire Department feed responded with ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Bushfire feed proxy is not configured')
  return parseBushfires(await res.json())
}

/** "Bushfire" or "Planned burn", from QFD's incident type. */
export function fireKindLabel(f: FireWarning) {
  return f.kind?.includes('PERMITTED') ? 'Planned burn' : 'Bushfire'
}
