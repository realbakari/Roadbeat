import { z } from 'zod'
import { stripHtml } from '../lib/format.js'
import type { LngLat } from '../lib/distance.js'
import { decodePolyline } from '../lib/polyline.js'
import { NSW_BORDER_LAT } from '../lib/nswBorder.js'

// Transport for NSW's Live Traffic Hazards (its Open Data Hub, CC BY 4.0), for
// roads just south of the Queensland border. The API needs a key, so
// Roadbeat's server reads it (api/_lib/endpoints/nsw-hazards.ts, with the
// TFNSW_API_KEY setting) and the app reads /api/nsw-hazards. Fires come from
// the NSW RFS layer instead. Each hazard's fields are shown as published;
// times are epoch milliseconds, shown in Brisbane time like everything else.

export const NSW_HAZARDS_URL = '/api/nsw-hazards'
export const NSW_HAZARDS_SOURCE = 'https://api.transport.nsw.gov.au/v1/live/hazards'
export const NSW_HAZARDS_PAGE = 'https://www.livetraffic.com/'
export const NSW_HAZARDS_ATTRIBUTION = '© Transport for NSW, Live Traffic Hazards, CC BY 4.0'

/** The API's hazard types Roadbeat reads, as its paths name them. */
export const NSW_HAZARD_KINDS = ['incident', 'flood', 'roadwork', 'majorevent'] as const
export type NswHazardKind = (typeof NSW_HAZARD_KINDS)[number]

/** NSW road hazards on the map: slate, and red for the ones Transport for NSW marks major. */
export const NSW_HAZARD_COLOR = { normal: '#475569', major: '#b91c1c' }

/** Live Traffic NSW's own names for the types. */
export const NSW_HAZARD_LABEL: Record<NswHazardKind, string> = { incident: 'Incident', flood: 'Flood', roadwork: 'Roadwork', majorevent: 'Major event' }

export interface NswRoad {
  street: string
  /** "at", "just past", "between"… with the cross street, as published. */
  qualifier: string | null
  cross: string | null
  suburb: string | null
  region: string | null
  /** Each published lane impact: direction, extent ("Closed", "Affected") and what's affected. */
  lanes: { direction: string | null; extent: string | null; description: string | null }[]
}

export interface NswHazard {
  /** `<kind>-<id>`: the API's ids are per type. */
  id: string
  /** The API's own id, for Live Traffic NSW's incident page. */
  sourceId: number
  kind: NswHazardKind
  /** mainCategory as published, e.g. "BREAKDOWN", "FLOODING", "SCHEDULED ROADWORK". */
  category: string
  subCategory: string | null
  /** displayName or headline as published. */
  title: string
  /** incidentKind: "Planned" or "Unplanned", or null when not published. */
  incidentKind: string | null
  major: boolean
  roads: NswRoad[]
  /** adviceA, adviceB and adviceC, as published, blanks dropped. */
  advice: string[]
  otherAdvice: string | null
  diversions: string | null
  attending: string[]
  /**
   * A planned hazard's published schedule, one line per period, e.g.
   * "Monday, 7:00pm to 5:00am: Tunnel closed, both directions". Its times are
   * NSW local time as written, which runs daylight saving, so they're shown
   * labelled as NSW time and never converted.
   */
  schedule: string[]
  /** Minutes, only when published (the API sends -1 for none). */
  expectedDelay: number | null
  speedLimit: number | null
  created: number | null
  lastUpdated: number | null
  start: number | null
  end: number | null
  position: LngLat
  /** The hazard's published extent, in Google's encoded polyline format as published (decode with nswHazardLines). */
  polylines: string[]
}

const text = z
  .string()
  .nullish()
  .catch(null)
  .transform((v) => {
    const t = v?.trim()
    return t && t !== 'null' ? t : null
  })
const time = z.number().nullish().catch(null).transform((v) => (v && v > 0 ? v : null))
const positive = z.number().nullish().catch(null).transform((v) => (v != null && v > 0 ? v : null))

const Road = z.object({
  mainStreet: text,
  locationQualifier: text,
  crossStreet: text,
  suburb: text,
  region: text,
  impactedLanes: z
    .array(z.object({ affectedDirection: text, extent: text, description: text }).catch({ affectedDirection: null, extent: null, description: null }))
    .nullish()
    .catch(null),
})

const Feature = z.object({
  id: z.number(),
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]).rest(z.number()) }),
  properties: z.object({
    mainCategory: text,
    subCategoryA: text,
    displayName: text,
    headline: text,
    incidentKind: text,
    isMajor: z.boolean().nullish().catch(null),
    ended: z.boolean().nullish().catch(null),
    roads: z.array(Road.catch({ mainStreet: null, locationQualifier: null, crossStreet: null, suburb: null, region: null, impactedLanes: null })).nullish().catch(null),
    adviceA: text,
    adviceB: text,
    adviceC: text,
    otherAdvice: text,
    diversions: text,
    attendingGroups: z.array(z.string()).nullish().catch(null),
    expectedDelay: positive,
    speedLimit: positive,
    created: time,
    lastUpdated: time,
    start: time,
    end: time,
    encodedPolylines: z.array(z.object({ coords: z.string() }).catch({ coords: '' })).nullish().catch(null),
    periods: z
      .array(z.object({ fromDay: text, toDay: text, startTime: text, finishTime: text, roadtype: text, roadextent: text, direction: text }).catch({ fromDay: null, toDay: null, startTime: null, finishTime: null, roadtype: null, roadextent: null, direction: null }))
      .nullish()
      .catch(null),
  }),
})

const Feed = z.object({ features: z.array(z.unknown()) })

const plain = (html: string | null) => (html ? stripHtml(html) || null : null)

type Period = { fromDay: string | null; toDay: string | null; startTime: string | null; finishTime: string | null; roadtype: string | null; roadextent: string | null; direction: string | null }

/** One published period in words, from its own fields only; null when it names no day or time. */
function periodLine(p: Period): string | null {
  const days = [p.fromDay, p.toDay].filter(Boolean).join(' to ')
  const times = p.startTime && p.finishTime ? `${p.startTime} to ${p.finishTime}` : p.startTime
  const when = [days, times].filter(Boolean).join(', ')
  if (!when) return null
  const what = [p.roadtype && p.roadextent ? `${p.roadtype} ${p.roadextent.toLowerCase()}` : p.roadextent, p.direction?.toLowerCase()].filter(Boolean).join(', ')
  return what ? `${when}: ${what}` : when
}

/**
 * One hazard type's feed as hazards near the Queensland border: north of
 * NSW_BORDER_LAT, by the published point or any point of its published
 * extent. Ended hazards and items without a point or a category are skipped.
 */
export function parseNswHazards(kind: NswHazardKind, json: unknown): NswHazard[] {
  const out: NswHazard[] = []
  for (const raw of Feed.parse(json).features) {
    const r = Feature.safeParse(raw)
    if (!r.success) continue
    const { id, geometry, properties: p } = r.data
    const position: LngLat = [geometry.coordinates[0], geometry.coordinates[1]]
    const polylines = (p.encodedPolylines ?? []).map((l) => l.coords).filter(Boolean)
    const lines = polylines.map(decodePolyline)
    const near = position[1] >= NSW_BORDER_LAT || lines.some((l) => l.some(([, lat]) => lat >= NSW_BORDER_LAT))
    if (!near || p.ended || !p.mainCategory) continue
    out.push({
      id: `${kind}-${id}`,
      sourceId: id,
      kind,
      category: p.mainCategory,
      subCategory: p.subCategoryA,
      title: p.headline ?? p.displayName ?? p.mainCategory,
      incidentKind: p.incidentKind,
      major: p.isMajor === true,
      roads: (p.roads ?? []).flatMap((road) =>
        road.mainStreet
          ? [{ street: road.mainStreet, qualifier: road.locationQualifier, cross: road.crossStreet, suburb: road.suburb, region: road.region, lanes: (road.impactedLanes ?? []).map((l) => ({ direction: l.affectedDirection, extent: l.extent, description: l.description })) }]
          : [],
      ),
      advice: [p.adviceA, p.adviceB, p.adviceC].filter((a): a is string => !!a),
      otherAdvice: plain(p.otherAdvice),
      diversions: plain(p.diversions),
      attending: (p.attendingGroups ?? []).map((g) => g.trim()).filter(Boolean),
      schedule: (p.periods ?? []).map(periodLine).filter((l): l is string => !!l),
      expectedDelay: p.expectedDelay,
      speedLimit: p.speedLimit,
      created: p.created,
      lastUpdated: p.lastUpdated,
      start: p.start,
      end: p.end,
      position,
      polylines,
    })
  }
  return out
}

const LngLatSchema = z.tuple([z.number(), z.number()])
/** The shape /api/nsw-hazards sends: NswHazard, checked again on arrival like any outside data. */
const Hazard: z.ZodType<NswHazard> = z.object({
  id: z.string(),
  sourceId: z.number(),
  kind: z.enum(NSW_HAZARD_KINDS),
  category: z.string(),
  subCategory: z.string().nullable(),
  title: z.string(),
  incidentKind: z.string().nullable(),
  major: z.boolean(),
  roads: z.array(
    z.object({
      street: z.string(),
      qualifier: z.string().nullable(),
      cross: z.string().nullable(),
      suburb: z.string().nullable(),
      region: z.string().nullable(),
      lanes: z.array(z.object({ direction: z.string().nullable(), extent: z.string().nullable(), description: z.string().nullable() })),
    }),
  ),
  advice: z.array(z.string()),
  otherAdvice: z.string().nullable(),
  diversions: z.string().nullable(),
  attending: z.array(z.string()),
  schedule: z.array(z.string()),
  expectedDelay: z.number().nullable(),
  speedLimit: z.number().nullable(),
  created: z.number().nullable(),
  lastUpdated: z.number().nullable(),
  start: z.number().nullable(),
  end: z.number().nullable(),
  position: LngLatSchema,
  polylines: z.array(z.string()),
})

/** A hazard's published extent as lines of [lng, lat] points; single points are dropped. */
export function nswHazardLines(h: NswHazard): LngLat[][] {
  return h.polylines.map(decodePolyline).filter((l) => l.length > 1)
}

/** NSW hazards near the border, from Roadbeat's server. */
export async function fetchNswHazards(signal?: AbortSignal): Promise<NswHazard[]> {
  const res = await fetch(NSW_HAZARDS_URL, { signal })
  if (!res.ok) throw new Error(res.status === 503 ? "NSW hazards aren't set up on this server" : `NSW hazards responded with ${res.status}`)
  const body = z.object({ hazards: z.array(z.unknown()) }).parse(await res.json())
  return body.hazards.flatMap((h) => {
    const r = Hazard.safeParse(h)
    return r.success ? [r.data] : []
  })
}

/** The hazard's own page on Live Traffic NSW, which takes every type's id. */
export function nswHazardPage(h: NswHazard): string {
  return `https://www.livetraffic.com/incident-details/${h.sourceId}`
}

/** "Breakdown · Truck": the category and subcategory as published, in sentence case for reading; words with digits, like 4WD, keep their case. */
export function nswHazardHeading(h: NswHazard): string {
  const words = h.category.trim().split(/\s+/).map((w) => (/\d/.test(w) ? w : w.toLowerCase()))
  const sentence = words.join(' ')
  return [sentence.charAt(0).toUpperCase() + sentence.slice(1), h.subCategory].filter(Boolean).join(' · ')
}
