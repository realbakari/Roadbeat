import type { NewsItem, NewsPlace, NewsRoad } from '../api/newsTypes.js'
import { timeAgo } from './format'
import { lastDate } from './newsItems.js'
import { roadBounds } from './newsRoads.js'

/**
 * Reports grouped as one story. A news story groups headlines from different
 * outlets that share most of their words within a few hours of each other.
 * Official items are never grouped with news or with each other, so a police
 * release never reads as confirming a news report.
 */
export interface NewsStory {
  /** The id of the story's earliest item, so a story keeps its id as reports join it. */
  id: string
  kind: NewsItem['kind']
  /** Newest first. */
  items: NewsItem[]
  /** Distinct publishers, in the order they first reported it. */
  publishers: string[]
  /** Every place matched in any of its items, first named first. */
  places: NewsPlace[]
  /** Every road placed from any of its items, one per road and locality. */
  roads: NewsRoad[]
  /** Council areas the story belongs to: those of its places, and a council source's own area. */
  areas: string[]
  /** Whether any report is a live blog, by its publisher's own marking (see isLiveBlog). */
  live: boolean
  first: number
  /** The latest date any publisher gave a report in the story, including updates. */
  latest: number
}

// How publishers mark live blogs. ABC titles a running blog "Live: …" and keeps
// "-live-" in its link afterwards; The Guardian files live blogs under /live/.
const LIVE_TITLE = /^live:/i
const LIVE_PATH = /(^|[/-])live([/-]|$)/i

/** Whether the publisher marks an item as a live blog. A format label, not a claim it is updating now. */
export function isLiveBlog(item: Pick<NewsItem, 'title' | 'link'>): boolean {
  return LIVE_TITLE.test(item.title) || LIVE_PATH.test(new URL(item.link).pathname)
}

const STOPWORDS = new Set(
  `a an and are as at be been but by for from has have he her his how in into is it its man woman new of on or over says she that the their
  they this to up was were what when who why will with after amid about than more just out not off now could would before during
  queensland qld`.split(/\s+/),
)

/** Content words of a headline: lower case, without punctuation, stopwords or words under three letters. */
export function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/['’]s\b/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  )
}

/**
 * Whether two headlines describe the same story: at least three content words
 * in common, making up at least half of the shorter headline's content words.
 */
export function sameStory(a: Set<string>, b: Set<string>): boolean {
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.5
}

/** Reports more than this far apart are separate stories, however alike their headlines. */
export const STORY_WINDOW = 12 * 60 * 60_000

/**
 * Groups items into stories, newest story first. News items with the same link are
 * one report (ABC files a story in more than one feed). Grouping is single-link
 * in publication order: an item joins the first story holding a news item it
 * matches within STORY_WINDOW, so the result depends only on the items.
 */
export function groupStories(items: NewsItem[]): NewsStory[] {
  const byLink = new Map<string, NewsItem>()
  for (const it of [...items].sort((a, b) => a.published - b.published || a.id.localeCompare(b.id))) {
    // Every BoM warning links to the same page, so official items are told apart by id.
    const key = it.kind === 'news' ? it.link : it.id
    if (!byLink.has(key)) byLink.set(key, it)
  }
  const groups: { items: NewsItem[]; words: Set<string>[] }[] = []
  for (const it of byLink.values()) {
    const words = titleWords(it.title)
    const group =
      it.kind === 'news'
        ? groups.find(
            (g) =>
              g.items[0].kind === 'news' &&
              g.items.some((o, i) => it.published - o.published <= STORY_WINDOW && sameStory(words, g.words[i])),
          )
        : undefined
    if (group) {
      group.items.push(it)
      group.words.push(words)
    } else {
      groups.push({ items: [it], words: [words] })
    }
  }
  return groups
    .map(({ items: list }) => {
      const places = new Map<string, NewsPlace>()
      for (const it of list) for (const p of it.places) if (!places.has(p.name)) places.set(p.name, p)
      const roads = new Map<string, NewsRoad>()
      for (const it of list) for (const r of it.roads) if (!roads.has(`${r.name}|${r.locality}`)) roads.set(`${r.name}|${r.locality}`, r)
      const newest = [...list].sort((a, b) => lastDate(b) - lastDate(a))
      return {
        id: list[0].id,
        kind: list[0].kind,
        items: newest,
        publishers: [...new Set(list.map((i) => i.publisher))],
        places: [...places.values()],
        roads: [...roads.values()],
        areas: [...new Set([...places.values()].flatMap((p) => (p.lga ? [p.lga] : [])).concat(list.flatMap((it) => (it.area ? [it.area] : []))))],
        live: list.some(isLiveBlog),
        first: list[0].published,
        latest: Math.max(...list.map(lastDate)),
      }
    })
    .sort((a, b) => b.latest - a.latest || a.id.localeCompare(b.id))
}

/** Where the map should show a story: its first road, else its first place, else nowhere. */
export function storyBounds(story: NewsStory | null): [[number, number], [number, number]] | null {
  const road = story?.roads[0]
  if (road) return roadBounds(road)
  const place = story?.places[0]
  return place ? [place.position, place.position] : null
}

/** "Updated 5 minutes ago" when the publisher moved the date forward, else "2 hours ago". */
export function reportedAgo(updated: boolean, at: number, now: number): string {
  return `${updated ? 'Updated ' : ''}${timeAgo(at, now)}`
}

/** "ABC", "ABC and 7NEWS", "ABC, 7NEWS and Brisbane Times". */
export function publisherList(publishers: string[]): string {
  if (publishers.length <= 1) return publishers[0] ?? ''
  return `${publishers.slice(0, -1).join(', ')} and ${publishers[publishers.length - 1]}`
}

/** "Official · Queensland Police", "News report · ABC", or "News report · Reported by ABC and 7NEWS". */
export function storySourceLine(story: NewsStory): string {
  if (story.kind === 'official') return `Official · ${story.publishers[0]}`
  return story.publishers.length > 1 ? `News report · Reported by ${publisherList(story.publishers)}` : `News report · ${story.publishers[0]}`
}

/** "Located from: Toowoomba, Dalby", GA's epicentre, or null when no place was matched. */
export function storyLocatedLine(story: NewsStory): string | null {
  const names = storyPlaceNames(story)
  if (names) return `Located from: ${names}`
  return story.places.length ? `Location from ${story.publishers[0]}` : null
}

/** "Avaline Boulevard, Burpengary East; Narangba": the roads and gazetteer places that placed a story, or null if none did. */
export function storyPlaceNames(story: NewsStory): string | null {
  const onRoads = new Set(story.roads.map((r) => r.locality))
  const places = story.places.filter((p) => p.via === 'gazetteer' && !onRoads.has(p.name)).map((p) => p.name)
  const names = [...story.roads.map((r) => `${r.name}, ${r.locality}`), ...places]
  return names.length ? names.join('; ') : null
}

export interface StoryFilter {
  /** A council area from the gazetteer, or 'all', or 'unlocated' for stories that name no place. */
  region: string
  /** A publisher, or 'all'. */
  outlet: string
  /** Show official sources, news outlets, or both. */
  kind: 'all' | NewsItem['kind']
  /** Only stories with a report in the last this many hours (the monitor keeps 48). */
  hours: 6 | 24 | 48
  /** Words that must all appear in a story's headlines, summaries or place names. */
  query: string
  /** Only stories that name this place: set by a shared map pin. */
  place: string | null
  /** Only stories with a live blog. */
  live: boolean
}

export const DEFAULT_STORY_FILTER: StoryFilter = { region: 'all', outlet: 'all', kind: 'all', hours: 48, query: '', place: null, live: false }

export function filterStories(stories: NewsStory[], f: StoryFilter, now: number): NewsStory[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return stories.filter(
    (s) =>
      now - s.latest <= f.hours * 60 * 60_000 &&
      (!words.length || words.every((w) => storyText(s).includes(w))) &&
      (!f.place || s.places.some((p) => p.name === f.place)) &&
      (!f.live || s.live) &&
      (f.kind === 'all' || s.kind === f.kind) &&
      (f.outlet === 'all' || s.publishers.includes(f.outlet)) &&
      (f.region === 'all' || (f.region === 'unlocated' ? !s.areas.length : s.areas.includes(f.region))),
  )
}

const storyText = (s: NewsStory) =>
  [...s.items.flatMap((i) => [i.title, i.summary ?? '', i.publisher]), ...s.places.map((p) => p.name)].join(' ').toLowerCase()

/** Council areas named by any story, with how many stories name each, most first. */
export function storyRegions(stories: NewsStory[]): { lga: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of stories) for (const lga of s.areas) counts.set(lga, (counts.get(lga) ?? 0) + 1)
  return [...counts].map(([lga, count]) => ({ lga, count })).sort((a, b) => b.count - a.count || a.lga.localeCompare(b.lga))
}

/** How recent a story must be for its outlet count to lift it on the dashboard. */
export const HEADLINE_HOURS = 6

/**
 * The dashboard's headline stories: stories from the last few hours carried by
 * the most outlets come first, then the newest. Counting outlets is the only
 * ranking; nothing judges what a story says.
 */
export function headlineStories(stories: NewsStory[], now: number, n = 4): NewsStory[] {
  const weight = (s: NewsStory) => (now - s.latest <= HEADLINE_HOURS * 60 * 60_000 ? s.publishers.length : 0)
  return [...stories].sort((a, b) => weight(b) - weight(a) || b.latest - a.latest).slice(0, n)
}
