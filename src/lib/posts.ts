import type { EventHistory, HistoryEvent } from '../api/historyTypes'
import { fireKindLabel, type FireWarning } from '../api/bushfires'
import type { QldWarning } from '../api/qldWarnings'
import type { TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { BRISBANE_OFFSET_MS, brisbaneDayDateTime } from './aest'
import { isClosure, isCurrent } from './eventStatus'
import { eventPlace, eventTitle, impactLine } from './eventText'
import { clean } from './format'
import { MAJOR_LEVELS } from './majorIncidents'
import type { NewsStory } from './newsStories'
import { fireDetail, newsDetail, roadDetail, transitDetail, warningDetail, type PostDetail } from './postDetails'

// The News tab's timeline: what each official source has published, one post
// per item, newest activity first, like a social feed that only publishers
// post to. Read-only: there are no likes, replies or counts, because no
// source publishes them. Every time on a post is the publisher's own stamp,
// labelled for what it is ("Issued", "Updated", "In effect from").

export type PostSource = 'road' | 'fire' | 'warning' | 'transit' | 'news'

/** A later update to a post, at the publisher's own time, saying only what the published fields show changed. */
export interface Reply {
  at: number
  text: string
  /** Who published it, when not the post's own publisher (a later report of a news story), else null. */
  by: string | null
}

export interface Post {
  /** Unique across sources, e.g. "road:123". */
  id: string
  source: PostSource
  /** Who published it, as the item credits them. */
  publisher: string
  /** Who the publisher acts for or passes it on from, in small type beside the name: "Transport and Main Roads", "from Transport for NSW". */
  handle: string | null
  /** What kind of item it is, in the publisher's terms: "Hazard", "Bushfire", "Flood warning", "Service alert". */
  kind: string
  /** The time the post is filed under: when it was published or issued. */
  at: number
  stamp: 'Published' | 'Issued' | 'In effect from' | 'Reported'
  /** The publisher's own last-updated time, when later than `at`, else null. */
  updated: number | null
  /** The latest of `at`, `updated` and the replies, for ordering by activity. */
  latest: number
  /** The publisher's own level or priority, in its words, or null. */
  level: string | null
  /** At one of the publishers' top levels (MAJOR_LEVELS), or a road closure. */
  major: boolean
  title: string
  /** A line of the publisher's own text, or null. */
  body: string | null
  place: string | null
  /** App hash that opens the item's own page. */
  href: string
  /** Updates since it was published, oldest first. */
  replies: Reply[]
  /** The road event's id, for Watching. */
  eventId: number | null
  /** For a news story, the outlet kind, so outlets stay apart from official sources. */
  newsKind: NewsStory['kind'] | null
  /** What the post's icon shows: the road event's type, or the fire or warning's level. */
  mark: string | null
  /** A council publisher's own site icon, as its news items carry it. */
  icon: string | null
  /** The publisher's own reference for the item, shown in small type: "#712345", "SEQ-500656". */
  ref: string | null
  /** The item on the publisher's own site, or null when the feed gives none. */
  sourceUrl: string | null
  /** Everything the publisher filled in, for the post's own page. */
  detail: PostDetail
  /**
   * What the post is about, from the publisher's own fields: a road event's
   * road and locality, a fire's or warning's area. Posts that share one are
   * related; null when the publisher names nothing to match on.
   */
  topic: string | null
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/**
 * The time in a warning's own "Issued at 10:00am, Friday 16 October 2026"
 * (Queensland time), or null when it isn't written that way. The feed carries
 * no other issue time.
 */
export function issuedTime(issued: string | null): number | null {
  const m = issued && /Issued at (\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b.*?(\d{1,2})\s+([a-z]+)\s+(\d{4})/i.exec(issued)
  if (!m) return null
  const month = MONTHS.indexOf(m[5].toLowerCase())
  const hour = Number(m[1])
  if (month < 0 || hour < 1 || hour > 12) return null
  const h24 = (hour % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)
  return Date.UTC(Number(m[6]), month, Number(m[4]), h24, Number(m[2] ?? 0)) - BRISBANE_OFFSET_MS
}

/** What changed between two published versions of an event, in QLDTraffic's own terms, or null when none of the kept fields did. */
function changes(before: HistoryEvent, after: HistoryEvent): string | null {
  const said: string[] = []
  if (before.type !== after.type) said.push(`Type changed from ${before.type} to ${after.type}`)
  if (before.priority !== after.priority) said.push(`Priority changed from ${before.priority} to ${after.priority}`)
  if (before.closure !== after.closure) said.push(after.closure ? 'Now filed as a road closure' : 'No longer filed as a road closure')
  return said.length ? said.join(' · ') : null
}

/**
 * A road event's updates that changed its type, priority or closure: each
 * version the history kept, at its own `last_updated`, compared with the one
 * before. An update that changed only other details isn't threaded; the
 * post's own "updated" time covers it.
 */
export function eventReplies(e: TrafficEvent, history: EventHistory | null): Reply[] {
  const id = e.properties.id
  const versions = Object.values(history?.events ?? {})
    .filter((v) => v.id === id && v.updated != null)
    .sort((a, b) => (a.updated ?? 0) - (b.updated ?? 0))
  return versions.slice(1).flatMap((v, i) => {
    const text = changes(versions[i], v)
    return text ? [{ at: v.updated ?? 0, text, by: null }] : []
  })
}

/** A topic key from the publisher's own names, or null unless every part is given. */
function topicOf(source: PostSource, ...names: (string | null)[]): string | null {
  return names.every(Boolean) ? [source, ...names].join('|').toLowerCase() : null
}

const isMajorLevel = (level: string) => (MAJOR_LEVELS as readonly string[]).includes(level)
const latestOf = (at: number, replies: Reply[]) => Math.max(at, ...replies.map((r) => r.at))

function roadPost(e: TrafficEvent, history: EventHistory | null): Post | null {
  const p = e.properties
  const at = ms(p.published)
  if (at == null) return null
  const replies = eventReplies(e, history).filter((r) => r.at > at)
  const lastUpdated = ms(p.last_updated)
  const updated = lastUpdated != null && lastUpdated > at ? lastUpdated : null
  const provider = clean(p.source?.provided_by)
  return {
    id: `road:${p.id}`,
    source: 'road',
    publisher: 'QLDTraffic',
    handle: provider && provider !== 'Department of Transport and Main Roads' ? `from ${provider}` : 'Transport and Main Roads',
    kind: clean(p.event_subtype) ? `${p.event_type} · ${clean(p.event_subtype)}` : p.event_type,
    at,
    stamp: 'Published',
    updated,
    latest: latestOf(updated ?? at, replies),
    level: p.event_priority,
    major: p.event_priority === 'Red Alert' || isClosure(e),
    title: eventTitle(e),
    body: impactLine(e) ?? clean(p.description),
    place: eventPlace(e) || null,
    href: `event/${p.id}`,
    replies,
    eventId: p.id,
    newsKind: null,
    mark: p.event_type,
    icon: null,
    ref: `#${p.id}`,
    sourceUrl: clean(p.web_link),
    detail: roadDetail(e),
    topic: topicOf('road', clean(p.road_summary?.road_name), clean(p.road_summary?.locality)),
  }
}

function firePost(f: FireWarning): Post | null {
  const at = f.issued ?? f.published
  if (at == null) return null
  return {
    id: `fire:${f.id}`,
    source: 'fire',
    publisher: 'Queensland Fire Department',
    handle: null,
    kind: f.level === 'Information' ? fireKindLabel(f) : `${fireKindLabel(f)} warning`,
    at,
    updated: null,
    stamp: 'Issued',
    latest: at,
    level: f.levelText,
    major: isMajorLevel(f.level),
    title: f.area ?? f.title,
    body: clean(f.callToAction) ?? clean(f.status),
    place: clean(f.location),
    href: `fire/${encodeURIComponent(f.id)}`,
    replies: [],
    eventId: null,
    newsKind: null,
    mark: f.level,
    icon: null,
    ref: null,
    sourceUrl: null,
    detail: fireDetail(f),
    topic: topicOf('fire', f.area),
  }
}

function warningPost(w: QldWarning): Post | null {
  const at = issuedTime(w.issued)
  if (at == null) return null
  return {
    id: `warning:${w.id}`,
    source: 'warning',
    publisher: w.from ?? 'Queensland Disaster Management',
    handle: w.from ? 'via Queensland Disaster Management' : null,
    kind: w.type && w.type !== 'Other' ? `${w.type} warning` : 'Warning',
    at,
    updated: null,
    stamp: 'Issued',
    latest: at,
    level: w.levelText,
    major: isMajorLevel(w.level),
    title: w.area ?? w.title,
    body: clean(w.callToAction) ?? clean(w.header),
    place: null,
    href: `place/warning/${encodeURIComponent(w.id)}`,
    replies: [],
    eventId: null,
    newsKind: null,
    mark: w.level,
    icon: null,
    ref: null,
    sourceUrl: null,
    detail: warningDetail(w),
    topic: topicOf('warning', w.area),
  }
}

/** A Translink alert, filed under the start of the period it's in effect now. Translink publishes no issue time, so an alert not in effect now, or with no start, isn't posted. */
function transitPost(a: TransitAlert, now: number): Post | null {
  const period = a.periods.find((p) => (p.start == null || p.start <= now) && (p.end == null || p.end > now))
  if (period?.start == null) return null
  return {
    id: `transit:${a.id}`,
    source: 'transit',
    publisher: 'Translink',
    handle: null,
    kind: a.effect,
    at: period.start,
    updated: null,
    stamp: 'In effect from',
    latest: period.start,
    level: null,
    major: false,
    title: a.header,
    body: a.routes.length ? `Routes ${a.routes.slice(0, 8).join(', ')}${a.routes.length > 8 ? ` and ${a.routes.length - 8} more` : ''}` : null,
    place: null,
    href: `transit/alert/${encodeURIComponent(a.id)}`,
    replies: [],
    eventId: null,
    newsKind: null,
    mark: null,
    icon: null,
    ref: a.id,
    sourceUrl: a.url,
    detail: transitDetail(a),
    topic: null,
  }
}

function newsPost(s: NewsStory): Post {
  // Items are newest first; the story is filed under its first report.
  const lead = s.items.at(-1) ?? s.items[0]
  // Later reports of the same story, by other publishers, are its replies.
  const replies = s.items
    .slice(0, -1)
    .reverse()
    .map((i) => ({ at: i.updated ?? i.published, text: i.title, by: i.publisher }))
  return {
    id: `news:${s.id}`,
    source: 'news',
    publisher: lead.publisher,
    handle: null,
    kind: s.kind === 'official' ? 'Notice' : 'News report',
    at: lead.published,
    updated: null,
    stamp: 'Reported',
    latest: Math.max(s.latest, latestOf(lead.published, replies)),
    level: null,
    major: false,
    title: lead.title,
    body: lead.summary,
    place: s.places[0]?.name ?? null,
    href: `news/${encodeURIComponent(s.id)}`,
    replies,
    eventId: null,
    newsKind: s.kind,
    mark: null,
    icon: lead.icon,
    ref: null,
    sourceUrl: lead.link,
    detail: newsDetail(s),
    topic: null,
  }
}

export interface PostSources {
  events: TrafficEvent[] | null
  fires: FireWarning[] | null
  warnings: QldWarning[] | null
  alerts: TransitAlert[] | null
  stories: NewsStory[]
  history: EventHistory | null
  now: number
}

/** Every post from the loaded sources, the latest activity first. A source that hasn't loaded adds none; the view says so. */
export function buildPosts({ events, fires, warnings, alerts, stories, history, now }: PostSources): Post[] {
  const posts = [
    ...(events ?? []).filter((e) => isCurrent(e, now)).map((e) => roadPost(e, history)),
    ...(fires ?? []).map(firePost),
    ...(warnings ?? []).map(warningPost),
    ...(alerts ?? []).map((a) => transitPost(a, now)),
    ...stories.map(newsPost),
  ].filter((p): p is Post => p != null)
  return posts.sort((a, b) => b.latest - a.latest)
}

export type PostView = 'latest' | 'major' | 'active' | 'watching'

/**
 * The posts a view shows: everything, those at the publishers' top levels or
 * road closures, those on a road or area with activity in the last
 * ACTIVE_WINDOW_MS (ordered by mostActive), or the road events this browser
 * watches.
 */
export function postsFor(posts: Post[], view: PostView, watched: number[], now: number): Post[] {
  if (view === 'major') return posts.filter((p) => p.major)
  if (view === 'active') return mostActive(posts, now).flatMap((g) => g.posts)
  if (view === 'watching') return posts.filter((p) => p.eventId != null && watched.includes(p.eventId))
  return posts
}

/** The colour of a publisher's lane on the timeline's rail, as a theme token (src/index.css). Decorative: the publisher is always named in words. */
export function laneOf(post: Post): string {
  switch (post.source) {
    case 'road':
      return 'var(--lane-road)'
    case 'fire':
      return 'var(--lane-fire)'
    case 'warning':
      return 'var(--lane-warning)'
    case 'transit':
      return 'var(--lane-transit)'
    default:
      return post.newsKind === 'official' ? 'var(--lane-official)' : 'var(--lane-news)'
  }
}

/** A post in the feed's order, and whether it continues the related post above it. */
export interface FeedEntry {
  post: Post
  /** Shares its topic with the post above, so the two are joined on the rail. */
  joined: boolean
}

/** How far back Most active counts. */
export const ACTIVE_WINDOW_MS = 6 * 3_600_000

/** The distinct times a post's publisher put it out or updated it since `since`: its publication, its last update, and each threaded update. */
export function activityTimes(post: Post, since: number): number[] {
  return [...new Set([post.at, post.updated, ...post.replies.map((r) => r.at)])].filter((t): t is number => t != null && t >= since)
}

/** A road or area on Most active: its name, how many posts and updates its publishers put out in the window, and its posts, newest activity first. */
export interface ActiveTopic {
  topic: string
  /** "Bruce Highway, Gympie" or a fire's or warning's area, as the publisher names it. */
  name: string
  count: number
  posts: Post[]
}

/**
 * Roads and areas ranked by how many posts and updates their publishers put
 * out in the ACTIVE_WINDOW_MS before `now`, the most first, ties by the
 * newest activity. Counted from publishers' own times, not from readers;
 * posts with no road or area to group by aren't ranked.
 */
export function mostActive(posts: Post[], now: number): ActiveTopic[] {
  const since = now - ACTIVE_WINDOW_MS
  const byTopic = new Map<string, ActiveTopic>()
  for (const p of posts) {
    if (!p.topic) continue
    const t = byTopic.get(p.topic) ?? { topic: p.topic, name: topicName(p), count: 0, posts: [] }
    t.count += activityTimes(p, since).length
    t.posts.push(p)
    byTopic.set(p.topic, t)
  }
  const latest = (t: ActiveTopic) => Math.max(...t.posts.map((p) => p.latest))
  return [...byTopic.values()]
    .filter((t) => t.count > 0)
    .map((t) => ({ ...t, posts: [...t.posts].sort((a, b) => b.latest - a.latest) }))
    .sort((a, b) => b.count - a.count || latest(b) - latest(a))
}

/** A topic's name in the publisher's words: the road and its locality, or the area. */
function topicName(p: Post): string {
  const locality = p.source === 'road' ? p.place?.split(' · ')[0] : null
  return locality ? `${p.title}, ${locality}` : p.title
}

/**
 * Gathers related posts: each topic appears where its newest activity falls,
 * with the topic's other posts straight after it, newest first. Posts with no
 * topic stand alone. The order is otherwise unchanged.
 */
export function gatherRelated(posts: Post[]): FeedEntry[] {
  const byTopic = new Map<string, Post[]>()
  for (const p of posts) if (p.topic) byTopic.set(p.topic, [...(byTopic.get(p.topic) ?? []), p])
  const placed = new Set<string>()
  const out: FeedEntry[] = []
  for (const p of posts) {
    if (!p.topic) {
      out.push({ post: p, joined: false })
      continue
    }
    if (placed.has(p.topic)) continue
    placed.add(p.topic)
    ;(byTopic.get(p.topic) ?? [p]).forEach((q, i) => out.push({ post: q, joined: i > 0 }))
  }
  return out
}

/** The other posts on a post's topic, newest activity first. */
export function relatedPosts(posts: Post[], post: Post): Post[] {
  return post.topic ? posts.filter((p) => p.topic === post.topic && p.id !== post.id) : []
}

/** A post's words for sharing: what it is, who published it and when, in Queensland time. */
export function shareText(post: Post): string {
  const who = post.handle ? `${post.publisher} (${post.handle})` : post.publisher
  const when = post.updated != null ? `updated ${brisbaneDayDateTime.format(post.updated)}` : `${post.stamp.toLowerCase()} ${brisbaneDayDateTime.format(post.at)}`
  return `${post.title}. ${who}, ${when} AEST.`
}
