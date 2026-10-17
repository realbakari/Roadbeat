import { Client } from 'basic-ftp'
import { Writable } from 'node:stream'
import { parseBulletins, parseCameras, parseCentres, parseCouncilNotices, parseEnergexOutages } from '../../src/api/councilDashboard.js'
import { bomWarningFiles, parseBomAmoc, parseQuakes, parseRss, quakeLink } from '../../src/api/newsFeeds.js'
import { NEWS_SOURCES, type NewsSource } from '../../src/api/newsSources.js'
import { NewsSnapshot, type CouncilCamera, type CouncilCentre, type NewsItem, type Outage, type SourceStatus } from '../../src/api/newsTypes.js'
import { toCouncilCamera } from '../../src/lib/councilCameras.js'
import { dedupeOutages, fromCouncilNotice, fromPowerOutage } from '../../src/lib/outages.js'
import { mergeCentres, toCentre } from '../../src/lib/councilCentres.js'
import { fromBomWarning, fromBulletin, fromQuake, fromRss, mergeItems, type CouncilDashboard } from '../../src/lib/newsItems.js'
import { placeIndex, type GazetteerRow } from '../../src/lib/newsPlaces.js'
import { roadQuestion, roadsInLocalities } from '../../src/lib/newsRoads.js'
import { parseRoadSegments, roadQueryUrl } from '../../src/api/qldRoads.js'
import councils from '../../src/data/council-dashboards.json' with { type: 'json' }
import gazetteer from '../../src/data/qld-places.json' with { type: 'json' }
import { redis, storeConfigured } from './store.js'

// Reads every news monitor feed once and merges the result into the stored
// snapshot. api/news-ingest.ts runs it on a schedule; api/news.ts runs it on
// demand when there is no store, or the stored snapshot has gone stale.

const KEY = 'news:snapshot'
const index = placeIndex(gazetteer.places as GazetteerRow[])
const USER_AGENT = 'Roadbeat news monitor (reads headlines and links)'
// scripts/build-council-dashboards.mjs writes each dashboard as [council, area, page, feed, icon].
const DASHBOARDS: CouncilDashboard[] = (councils.dashboards as [string, string | null, string, string, string | null][]).map(([council, area, page, feed, icon]) => ({ council, area, page, feed, icon }))
const COUNCIL_SOURCE = { id: 'council-dashboards', publisher: 'Council disaster dashboards' }

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

/** The platform wraps some feeds in a JSON string, so a feed may need parsing twice. */
function feedJson(body: string): unknown {
  const once: unknown = JSON.parse(body)
  return typeof once === 'string' ? JSON.parse(once) : once
}

/**
 * One dashboard's feeds. Bulletins and centres must answer for the council to
 * count as answered; the Energex relay is missing on councils outside Energex's
 * area, and cameras and notices are optional, so each of those fails on its own.
 */
async function readDashboard(d: CouncilDashboard) {
  // An optional feed in a shape we don't read counts as listing nothing, like one that didn't answer.
  const optional = <T>(json: unknown, parse: (json: unknown) => T[]): T[] => {
    try {
      return json == null ? [] : parse(json)
    } catch {
      return []
    }
  }
  const feed = (name: string) => text(`${d.feed}/dashboard/${name}`).then(feedJson)
  const [bulletins, centres, cameras, notices, energex] = await Promise.all([
    feed('imsBulletin'),
    feed('imsEvac'),
    feed('getCameras').catch(() => null),
    feed('dashOutages').catch(() => null),
    feed('energexOutages').catch(() => null),
  ])
  return {
    items: parseBulletins(bulletins).map((b) => fromBulletin(d, b, index)),
    centres: parseCentres(centres).map((c) => toCentre(d, c)),
    cameras: optional(cameras, parseCameras).flatMap((c) => toCouncilCamera(d, c) ?? []),
    outages: [
      ...optional(notices, parseCouncilNotices).map((n) => fromCouncilNotice(d, n)),
      ...optional(energex, parseEnergexOutages).map((o) => fromPowerOutage(o, index, d.page)),
    ],
  }
}

/** Every council dashboard's feeds. A council that fails is named in `failed`; the others still count. */
async function readDashboards(): Promise<{ items: NewsItem[]; centres: CouncilCentre[]; cameras: CouncilCamera[]; outages: Outage[]; answered: Set<string>; failed: string[] }> {
  const results = await Promise.allSettled(DASHBOARDS.map(readDashboard))
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  return {
    items: ok.flatMap((r) => r.items),
    centres: ok.flatMap((r) => r.centres),
    cameras: ok.flatMap((r) => r.cameras),
    outages: dedupeOutages(ok.flatMap((r) => r.outages)),
    answered: new Set(DASHBOARDS.filter((_, i) => results[i].status === 'fulfilled').map((d) => d.council)),
    failed: DASHBOARDS.filter((_, i) => results[i].status === 'rejected').map((d) => d.council),
  }
}

// BoM products on its anonymous FTP server are under the BoM's default terms:
// personal or in-house use, with publishing reserved for registered users
// (bom.gov.au/catalogue/anon-ftp.shtml). So BoM warnings stay off until the
// operator has that permission and sets NEWS_BOM_WARNINGS=on.
const enabled = (s: NewsSource) => s.id !== 'bom' || process.env.NEWS_BOM_WARNINGS === 'on'

/**
 * Reads every enabled feed and every council dashboard in parallel. A feed that
 * fails is reported in `sources` and its earlier items are kept; a council that
 * fails keeps its earlier centres.
 */
export async function ingest(previous: NewsSnapshot | null, now = Date.now()): Promise<NewsSnapshot> {
  const list = NEWS_SOURCES.filter(enabled)
  const [results, dashboards] = await Promise.all([Promise.allSettled(list.map((s) => readSource(s, now))), readDashboards()])
  const feedSources: SourceStatus[] = list.map((s, i) => {
    const r = results[i]
    return r.status === 'fulfilled'
      ? { id: s.id, publisher: s.publisher, ok: true, count: r.value.length, error: null }
      : { id: s.id, publisher: s.publisher, ok: false, count: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
  })
  const councilSource: SourceStatus = {
    ...COUNCIL_SOURCE,
    ok: dashboards.answered.size > 0,
    count: dashboards.items.length,
    error: dashboards.failed.length ? `No answer from ${dashboards.failed.join(', ')}` : null,
  }
  const sources = [...feedSources, councilSource]
  const before = previous?.items ?? []
  const fresh = await placeRoads([...results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])), ...dashboards.items], before)
  const answered = new Set(sources.filter((s) => s.ok).map((s) => s.id))
  const kept = before.filter((it) => sources.some((s) => s.id === it.source))
  return {
    fetchedAt: now,
    sources,
    items: mergeItems(kept, fresh, answered, now),
    centres: mergeCentres(previous?.centres ?? [], dashboards.centres, dashboards.answered),
    cameras: dashboards.cameras,
    outages: dashboards.outages,
  }
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
