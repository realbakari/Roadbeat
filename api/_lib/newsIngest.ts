import { Client } from 'basic-ftp'
import { Writable } from 'node:stream'
import { bomWarningFiles, parseBomAmoc, parseQuakes, parseRss, quakeLink } from '../../src/api/newsFeeds.js'
import { NEWS_SOURCES, type NewsSource } from '../../src/api/newsSources.js'
import { NewsSnapshot, type NewsItem, type SourceStatus } from '../../src/api/newsTypes.js'
import { fromBomWarning, fromQuake, fromRss, mergeItems } from '../../src/lib/newsItems.js'
import { placeIndex, type GazetteerRow } from '../../src/lib/newsPlaces.js'
import { roadQuestion, roadsInLocalities } from '../../src/lib/newsRoads.js'
import { parseRoadSegments, roadQueryUrl } from '../../src/api/qldRoads.js'
import gazetteer from '../../src/data/qld-places.json' with { type: 'json' }
import { redis, storeConfigured } from './store.js'

// Reads every news monitor feed once and merges the result into the stored
// snapshot. api/news-ingest.ts runs it on a schedule; api/news.ts runs it on
// demand when there is no store, or the stored snapshot has gone stale.

const KEY = 'news:snapshot'
const index = placeIndex(gazetteer.places as GazetteerRow[])
const USER_AGENT = 'Roadbeat news monitor (reads headlines and links)'

async function text(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.5' }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${new URL(url).host} responded with ${res.status}`)
  return res.text()
}

/** Current Queensland warnings from the BoM's anonymous FTP server: each IDQ2xxxx product's AMOC file. */
async function bomWarnings(source: NewsSource, now: number): Promise<NewsItem[]> {
  const url = new URL(source.url)
  const client = new Client(15_000)
  try {
    await client.access({ host: url.hostname })
    const files = bomWarningFiles((await client.list(url.pathname)).map((f) => f.name))
    const out: NewsItem[] = []
    for (const name of files) {
      const chunks: Buffer[] = []
      await client.downloadTo(new Writable({ write: (c: Buffer, _e, done) => (chunks.push(c), done()) }), `${url.pathname}${name}`)
      const w = parseBomAmoc(Buffer.concat(chunks).toString('utf8'), now)
      if (w) out.push(fromBomWarning(source, w, index))
    }
    return out
  } finally {
    client.close()
  }
}

async function readSource(source: NewsSource, now: number): Promise<NewsItem[]> {
  switch (source.format) {
    case 'rss':
      return fromRss(source, parseRss(await text(source.url)), index, now)
    case 'bom-amoc':
      return bomWarnings(source, now)
    case 'ga-quakes':
      return parseQuakes(JSON.parse(await text(source.url))).map((q) => fromQuake(source, q, quakeLink(q.id)))
  }
}

// Each road lookup is one query to the state's roads service, so a run asks
// about at most this many new or changed items; the rest wait for the next run.
const MAX_ROAD_LOOKUPS = 20

/**
 * Places the roads each item names inside localities it also names. An item
 * already placed on an earlier run, with the same text, keeps its roads. A
 * failed lookup leaves the item without roads, to be asked again next run.
 */
async function placeRoads(items: NewsItem[], previous: NewsItem[]): Promise<NewsItem[]> {
  const known = new Map(previous.map((it) => [it.id, it]))
  let lookups = 0
  return Promise.all(
    items.map(async (item) => {
      const question = roadQuestion(item)
      if (!question) return item
      const before = known.get(item.id)
      if (before?.roads.length && before.title === item.title && before.summary === item.summary) return { ...item, roads: before.roads }
      const url = roadQueryUrl(question.names, question.localities.map((l) => l.name))
      if (!url || ++lookups > MAX_ROAD_LOOKUPS) return item
      try {
        const segments = parseRoadSegments(JSON.parse(await text(url)))
        return { ...item, roads: roadsInLocalities(question.names, question.localities, segments) }
      } catch {
        return item
      }
    }),
  )
}

// BoM products on its anonymous FTP server are under the BoM's default terms:
// personal or in-house use, with publishing reserved for registered users
// (bom.gov.au/catalogue/anon-ftp.shtml). So BoM warnings stay off until the
// operator has that permission and sets NEWS_BOM_WARNINGS=on.
const enabled = (s: NewsSource) => s.id !== 'bom' || process.env.NEWS_BOM_WARNINGS === 'on'

/** Reads every enabled feed in parallel. A feed that fails is reported in `sources` and its earlier items are kept. */
export async function ingest(previous: NewsItem[], now = Date.now()): Promise<NewsSnapshot> {
  const list = NEWS_SOURCES.filter(enabled)
  const results = await Promise.allSettled(list.map((s) => readSource(s, now)))
  const sources: SourceStatus[] = list.map((s, i) => {
    const r = results[i]
    return r.status === 'fulfilled'
      ? { id: s.id, publisher: s.publisher, ok: true, count: r.value.length, error: null }
      : { id: s.id, publisher: s.publisher, ok: false, count: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
  })
  const fresh = await placeRoads(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    previous,
  )
  const answered = new Set(sources.filter((s) => s.ok).map((s) => s.id))
  const kept = previous.filter((it) => list.some((s) => s.id === it.source))
  return { fetchedAt: now, sources, items: mergeItems(kept, fresh, answered, now) }
}

/** The stored snapshot, or null if there is none (or it no longer parses). */
export async function loadSnapshot(): Promise<NewsSnapshot | null> {
  if (!storeConfigured) return null
  const raw = await redis<string | null>(['GET', KEY])
  if (!raw) return null
  try {
    const parsed = NewsSnapshot.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function saveSnapshot(snapshot: NewsSnapshot) {
  if (storeConfigured) await redis(['SET', KEY, JSON.stringify(snapshot)])
}
