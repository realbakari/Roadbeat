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
})
export type NewsItem = z.infer<typeof NewsItem>

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
})
export type NewsSnapshot = z.infer<typeof NewsSnapshot>
