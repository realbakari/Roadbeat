import { z } from 'zod'

// The news monitor's stored and served shapes. The server writes them
// (api/_lib/newsIngest.ts) and the browser validates them on the way in
// (src/api/news.ts), so both sides share one definition.

const LngLat = z.tuple([z.number(), z.number()])

export const NewsPlace = z.object({
  /** The place name as matched in the text, or GA's own description of an epicentre. */
  name: z.string(),
  /** The council area the gazetteer files the place under; null for a position a source published. */
  lga: z.string().nullable(),
  position: LngLat,
  /** 'gazetteer': an exact match of a Queensland place name in the headline or summary. 'source': the publisher's own coordinates. */
  via: z.enum(['gazetteer', 'source']),
})
export type NewsPlace = z.infer<typeof NewsPlace>

export const NewsRoad = z.object({
  /** The road's name as Queensland's roads dataset spells it, such as "Avaline Boulevard". */
  name: z.string(),
  /** The gazetteer locality the same text names, which the road's segments run through or beside. */
  locality: z.string(),
  lga: z.string().nullable(),
  /** The dataset's segments of that road in that locality, simplified to about 10 m. */
  lines: z.array(z.array(LngLat)),
})
export type NewsRoad = z.infer<typeof NewsRoad>

export const NewsItem = z.object({
  id: z.string(),
  /** A source id from NEWS_SOURCES. */
  source: z.string(),
  publisher: z.string(),
  kind: z.enum(['news', 'official']),
  title: z.string(),
  link: z.string(),
  /** Epoch ms: the publisher's date when the monitor first saw the item. */
  published: z.number(),
  /** The publisher's later date for the same item, when it moved forward (live blogs do), or null. */
  updated: z.number().nullable().default(null),
  /** The publisher's summary, cut to what its licence allows (see NewsSource.summary), or null. Never the article itself. */
  summary: z.string().nullable(),
  places: z.array(NewsPlace),
  /** Roads the text names inside a locality it also names, placed from the official roads dataset. */
  roads: z.array(NewsRoad).default([]),
  /** The council area a council's own source covers, for the region filter; null for every other source. */
  area: z.string().nullable().default(null),
  /** A council publisher's own site icon; null for sources whose icon the app lists itself (PUBLISHER_ICONS). */
  icon: z.string().nullable().default(null),
})
export type NewsItem = z.infer<typeof NewsItem>

export const CouncilCentre = z.object({
  id: z.string(),
  council: z.string(),
  /** The council's area in the gazetteer, or null if it has no match. */
  area: z.string().nullable(),
  /** The council's own words: "Evacuation Centre", "Sandbag Station", "Place of Refuge"… */
  type: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  /** The council's own status text, such as "Open" or "Operational", or null if it gives none. */
  status: z.string().nullable(),
  note: z.string().nullable(),
  position: LngLat,
  /** The council's disaster dashboard, where the listing comes from. */
  dashboard: z.string(),
})
export type CouncilCentre = z.infer<typeof CouncilCentre>

export const CouncilCamera = z.object({
  /** The council's own number for the camera; unique within one dashboard only. */
  id: z.number(),
  council: z.string(),
  area: z.string().nullable(),
  /** Traffic or flood, from the council's own type name. */
  kind: z.enum(['webcam', 'floodcam']),
  description: z.string(),
  locality: z.string().nullable(),
  direction: z.string().nullable(),
  /** The address of the camera's latest image, on the council's camera host. */
  image: z.string(),
  position: LngLat,
  dashboard: z.string(),
})
export type CouncilCamera = z.infer<typeof CouncilCamera>

const Shape = z.object({ type: z.enum(['Point', 'LineString', 'Polygon']), coordinates: z.unknown() })

/**
 * An outage a council dashboard reports: an Energex power outage, which names
 * a suburb and streets and is placed by the suburb's gazetteer point, or a
 * notice the council entered itself (water works, fuel supply…), drawn at the
 * shape the council published.
 */
export const Outage = z.object({
  id: z.string(),
  source: z.enum(['energex', 'council']),
  council: z.string(),
  area: z.string().nullable(),
  /** "Power" for Energex; otherwise the council's own type name. */
  type: z.string(),
  title: z.string(),
  details: z.string().nullable(),
  /** Energex's status, or the council's "Planned"/"Unplanned". */
  status: z.string().nullable(),
  customers: z.number().nullable(),
  streets: z.array(z.string()),
  start: z.number().nullable(),
  end: z.number().nullable(),
  updated: z.number().nullable(),
  /** The council's published shape, or null for an Energex outage. */
  geometry: Shape.nullable(),
  /** The gazetteer suburb an Energex outage is placed by, or null for a council notice. */
  place: NewsPlace.nullable(),
  dashboard: z.string(),
})
export type Outage = z.infer<typeof Outage>

export const SourceStatus = z.object({
  id: z.string(),
  publisher: z.string(),
  ok: z.boolean(),
  /** Items kept from this source on the last run. */
  count: z.number(),
  error: z.string().nullable(),
})
export type SourceStatus = z.infer<typeof SourceStatus>

export const NewsSnapshot = z.object({
  /** When the feeds were last read, epoch ms. */
  fetchedAt: z.number(),
  sources: z.array(SourceStatus),
  items: z.array(NewsItem),
  /** Every centre the council dashboards list now, as published. */
  centres: z.array(CouncilCentre).default([]),
  /** Council cameras not already published through QLDTraffic. */
  cameras: z.array(CouncilCamera).default([]),
  /** Power outages and council notices the dashboards report now. */
  outages: z.array(Outage).default([]),
})
export type NewsSnapshot = z.infer<typeof NewsSnapshot>
