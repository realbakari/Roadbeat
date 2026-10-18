import { z } from 'zod'
import { decodeEntities, plainText } from '../lib/newsText.js'
import { cdata, xmlTag as tag } from '../lib/xml.js'
import type { NewsPlace } from './newsTypes.js'

type LngLat = NewsPlace['position']

// Parsers for the news monitor's feeds. They run on the server (api/_lib/newsIngest.ts),
// which has no DOMParser, so RSS and AMOC are read with patterns for the few
// elements the monitor uses. Each takes the raw response and returns plain data.

export interface RssItem {
  title: string
  link: string
  /** Epoch ms, or null when the feed gives no readable date. */
  published: number | null
  /** The item's description as published: markup, to be cut down with firstSentence(). */
  description: string
  categories: string[]
}

/** Items from an RSS 2.0 feed. Items without a title or an http(s) link are dropped. */
export function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = []
  for (const [block] of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const title = plainText(tag(block, 'title') ?? '')
    const link = decodeEntities(tag(block, 'link') ?? '').trim()
    if (!title || !/^https?:\/\//.test(link)) continue
    const date = Date.parse(tag(block, 'pubDate') ?? tag(block, 'dc:date') ?? '')
    out.push({
      title,
      link,
      published: Number.isFinite(date) ? date : null,
      description: tag(block, 'description') ?? '',
      categories: [...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/g)].map((m) => plainText(cdata(m[1]))).filter(Boolean),
    })
  }
  return out
}

export interface BomWarning {
  /** The BoM product id, such as IDQ20002. */
  id: string
  headline: string
  issued: number
  expires: number | null
}

/**
 * A current warning from a BoM AMOC file (the product's metadata), or null if
 * the file is not a warning, is a test, is cancelled, or has expired. Only the
 * headline is kept: the warning's text stays on the BoM's site.
 */
export function parseBomAmoc(xml: string, now: number): BomWarning | null {
  const id = tag(xml, 'identifier')
  const issued = Date.parse(tag(xml, 'issue-time-utc') ?? '')
  const expiry = Date.parse(tag(xml, 'expiry-time') ?? '')
  if (!id || !Number.isFinite(issued)) return null
  if (tag(xml, 'product-type') !== 'W' || tag(xml, 'status') !== 'O' || tag(xml, 'phase') === 'CAN') return null
  if (Number.isFinite(expiry) && expiry <= now) return null
  const headlines = [...new Set([...xml.matchAll(/<headline>([\s\S]*?)<\/headline>/g)].map((m) => plainText(m[1])).filter(Boolean))]
  if (!headlines.length) return null
  return { id, headline: headlines.join('; '), issued, expires: Number.isFinite(expiry) ? expiry : null }
}

/** BoM warning products for Queensland in an FTP directory listing (IDQ2xxxx are warnings; IDQ1xxxx are forecasts). */
export function bomWarningFiles(listing: string[]): string[] {
  return listing.filter((name) => /^IDQ2\d{4}\.amoc\.xml$/.test(name)).sort()
}

const Quakes = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        event_id: z.string().nullable(),
        origin_time: z.string().nullable(),
        preferred_magnitude: z.number().nullable(),
        preferred_magnitude_type: z.string().nullable(),
        description: z.string().nullable(),
        latitude: z.number(),
        longitude: z.number(),
      }),
    }),
  ),
})

export interface Earthquake {
  id: string
  /** GA's magnitude to one decimal place, as GA's own site shows it. */
  magnitude: string
  magnitudeType: string | null
  /** GA's description of where it was, such as "45 km NE of Innisfail, QLD". */
  place: string
  at: number
  position: LngLat
}

/** Queensland earthquakes from Geoscience Australia's WFS: those GA describes as in or off QLD. */
export function parseQuakes(json: unknown): Earthquake[] {
  return Quakes.parse(json).features.flatMap(({ properties: p }) => {
    const at = Date.parse(p.origin_time ?? '')
    if (!p.event_id || !p.description || !/,\s*QLD\b/.test(p.description) || p.preferred_magnitude == null || !Number.isFinite(at)) return []
    return [
      {
        id: p.event_id,
        magnitude: p.preferred_magnitude.toFixed(1),
        magnitudeType: p.preferred_magnitude_type,
        place: p.description.trim(),
        at,
        position: [p.longitude, p.latitude] as LngLat,
      },
    ]
  })
}

/** GA's page for an earthquake. */
export const quakeLink = (id: string) => `https://earthquakes.ga.gov.au/event/${encodeURIComponent(id)}`
