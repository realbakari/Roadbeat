import type { CouncilBulletin } from '../api/councilDashboard.js'
import type { BomWarning, Earthquake, RssItem } from '../api/newsFeeds.js'
import { BOM_WARNINGS_PAGE, type NewsSource } from '../api/newsSources.js'
import type { NewsItem } from '../api/newsTypes.js'
import { firstSentence, isQueenslandItem, plainText, wholeSummary } from './newsText.js'
import { locate, type PlaceIndex } from './newsPlaces.js'

/** A short stable id for a link or product (FNV-1a, 52 bits, base 36). */
export function itemId(key: string): string {
  let h = 0xcbf29ce484222325n
  for (const c of new TextEncoder().encode(key)) h = BigInt.asUintN(64, (h ^ BigInt(c)) * 0x100000001b3n)
  return (h >> 12n).toString(36)
}

// A feed date more than this far ahead of the clock is a publisher error, not a time to show.
const FUTURE_SLACK = 15 * 60_000

/**
 * Feed items as the monitor keeps them: headline, link, publisher, date and as
 * much of the summary as the source's licence allows (NewsSource.summary),
 * located only from that kept text. Items
 * with no date are dropped rather than given one, and so are non-Queensland
 * items from national feeds.
 */
export function fromRss(source: NewsSource, items: RssItem[], index: PlaceIndex, now: number): NewsItem[] {
  return items.flatMap((it) => {
    if (it.published == null || it.published > now + FUTURE_SLACK) return []
    if (source.qldOnly && !isQueenslandItem({ ...it, summary: plainText(it.description) })) return []
    const summary = source.summary === 'whole' ? wholeSummary(it.description) : firstSentence(it.description)
    return [
      {
        id: itemId(it.link),
        source: source.id,
        publisher: source.publisher,
        kind: source.kind,
        title: it.title,
        link: it.link,
        published: it.published,
        updated: null,
        summary: summary === it.title ? null : summary,
        places: locate(`${it.title}\n${summary ?? ''}`, index),
        roads: [],
        area: null,
      },
    ]
  })
}

/** A BoM warning: its headline only, linked to the BoM's Queensland warnings page. */
export function fromBomWarning(source: NewsSource, w: BomWarning, index: PlaceIndex): NewsItem {
  return {
    id: itemId(`${w.id}@${w.issued}`),
    source: source.id,
    publisher: source.publisher,
    kind: source.kind,
    title: w.headline,
    link: BOM_WARNINGS_PAGE,
    published: w.issued,
    updated: null,
    summary: null,
    places: locate(w.headline, index),
    roads: [],
    area: null,
  }
}

/** A Geoscience Australia earthquake, at GA's own epicentre. */
export function fromQuake(source: NewsSource, q: Earthquake, link: string): NewsItem {
  return {
    id: itemId(`ga:${q.id}`),
    source: source.id,
    publisher: source.publisher,
    kind: source.kind,
    title: `Magnitude ${q.magnitude} earthquake, ${q.place}`,
    link,
    published: q.at,
    updated: null,
    summary: null,
    places: [{ name: q.place, lga: null, position: q.position, via: 'source' }],
    roads: [],
    area: null,
  }
}

/** A council dashboard, as src/data/council-dashboards.json lists it. */
export interface CouncilDashboard {
  council: string
  /** The council's area in the gazetteer, or null. */
  area: string | null
  /** The dashboard's address for people. */
  page: string
  /** The address the server reads its feed from (http where the site's certificate chain is incomplete). */
  feed: string
}

/**
 * A council's bulletin as an official item: its title and whole text (up to
 * wholeSummary's cap), since councils publish these as public safety notices
 * to be passed on; dated by its latest time, linked to the council's
 * dashboard, and filed under the council's area.
 */
export function fromBulletin(d: CouncilDashboard, b: CouncilBulletin, index: PlaceIndex): NewsItem {
  const summary = wholeSummary(b.description)
  return {
    id: itemId(`${d.page}|${b.title}|${b.created}`),
    source: 'council-dashboards',
    publisher: d.council,
    kind: 'official',
    title: b.title,
    link: d.page,
    published: b.created,
    updated: b.updated != null && b.updated > b.created ? b.updated : null,
    summary: summary === b.title ? null : summary,
    places: locate(`${b.title}\n${summary ?? ''}`, index),
    roads: [],
    area: d.area,
  }
}

/** The publisher's latest date for an item: when it was updated, else when it was published. */
export const lastDate = (it: NewsItem) => it.updated ?? it.published

/** How long the monitor keeps an item after its publisher last dated it. */
export const KEEP_MS = 48 * 60 * 60_000
const MAX_ITEMS = 600

/**
 * The stored items after a run: this run's items replace earlier copies of the
 * same item, items from sources that failed this run are kept, and anything
 * not dated within KEEP_MS is dropped. A BoM warning that is no longer current
 * is dropped as soon as its source answers without it.
 */
export function mergeItems(previous: NewsItem[], fresh: NewsItem[], answered: Set<string>, now: number): NewsItem[] {
  const byId = new Map<string, NewsItem>()
  for (const it of previous) if (!(answered.has(it.source) && it.source === 'bom')) byId.set(it.id, it)
  for (const it of fresh) {
    const before = byId.get(it.id)
    byId.set(it.id, before ? revise(before, it) : it)
  }
  return [...byId.values()]
    .filter((it) => now - lastDate(it) <= KEEP_MS)
    .sort((a, b) => lastDate(b) - lastDate(a))
    .slice(0, MAX_ITEMS)
}

/** A new copy of a known item keeps its first date; a later publisher date becomes `updated`. */
function revise(before: NewsItem, after: NewsItem): NewsItem {
  const published = Math.min(before.published, after.published)
  const latest = Math.max(lastDate(before), after.published)
  return { ...after, published, updated: latest > published ? latest : null }
}
