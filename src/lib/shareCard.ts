import type { FireWarning } from '../api/bushfireFeed.js'
import type { NewsItem } from '../api/newsTypes.js'
import type { QldWarning } from '../api/qldWarningsFeed.js'
import type { TrafficEvent } from '../api/types.js'
import { brisbaneDayDateTime } from './aest.js'
import { eventPlace, eventTitle, impactLine } from './eventText.js'
import { clean } from './format.js'

// What a shared timeline post shows on other platforms: the preview tags and
// the 1200 × 630 card image (api/_lib/endpoints/share-image.ts), laid out like
// the timeline itself, with the publisher, its own words, its time in
// Queensland time and its licence credit. Server-safe: no browser-only code.
// Fuel prices never appear on a card: the Fuel Prices Queensland licence
// doesn't allow passing them to other platforms to publish.

export type CardSource = 'road' | 'fire' | 'warning' | 'transit' | 'news'

export interface ShareCard {
  /** The post's address on Roadbeat, from the site root. */
  path: string
  /** The headline: a road, an area, a news headline. */
  title: string
  /** A line of the publisher's own text, or null. */
  description: string | null
  publisher: string
  /** Who the publisher passes it on from, or null. */
  handle: string | null
  /** The publisher's kind of item: "Roadworks · Planned roadworks", "Flood warning". */
  kind: string
  /** The publisher's level in its own words, and the colour the app shows it in. */
  level: { text: string; color: string } | null
  /** "Published Tue, 20 Oct, 10:30 am AEST", or null when the item gives no time. */
  when: string | null
  place: string | null
  /** The publisher's lane colour on the timeline. */
  lane: string
  /** The licence credit the publisher asks for. */
  credit: string
}

/** Lane colours as the timeline's light theme draws them (src/index.css). */
const LANE: Record<CardSource | 'official', string> = {
  road: '#3d6fd6',
  fire: '#d4521f',
  warning: '#b97709',
  transit: '#7b52c7',
  news: '#8b5cf6',
  official: '#334155',
}

/** The warning system's level colours, and QLDTraffic's priorities as the app shows them. */
const LEVEL_COLOR: Record<string, string> = {
  'Emergency Warning': '#d6001c',
  'Watch and Act': '#ff7900',
  Advice: '#e8b400',
  'Red Alert': '#b91c1c',
  High: '#dc2626',
  Medium: '#d97706',
  Low: '#6b7280',
}
const levelOf = (text: string | null) => (text ? { text, color: LEVEL_COLOR[text] ?? '#6b7280' } : null)

const stamp = (label: string, t: number | null) => (t == null ? null : `${label} ${brisbaneDayDateTime.format(t)} AEST`)
const ms = (iso: string | null | undefined) => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

/** The address of a timeline post (as timelinePath in route.ts builds it). */
export const cardPath = (source: CardSource, id: string) => `/timeline/${source}/${encodeURIComponent(id)}`

export function roadCard(e: TrafficEvent): ShareCard {
  const p = e.properties
  const provider = clean(p.source?.provided_by)
  const updated = ms(p.last_updated)
  const published = ms(p.published)
  return {
    path: cardPath('road', String(p.id)),
    title: eventTitle(e),
    description: impactLine(e) ?? clean(p.description),
    publisher: 'QLDTraffic',
    handle: provider && provider !== 'Department of Transport and Main Roads' ? `from ${provider}` : 'Transport and Main Roads',
    kind: clean(p.event_subtype) ? `${p.event_type} · ${clean(p.event_subtype)}` : p.event_type,
    level: levelOf(p.event_priority),
    when: updated != null && (published == null || updated > published) ? stamp('Updated', updated) : stamp('Published', published),
    place: eventPlace(e) || null,
    lane: LANE.road,
    credit: 'QLDTraffic, Department of Transport and Main Roads, CC BY 4.0',
  }
}

export function fireCard(f: FireWarning): ShareCard {
  return {
    path: cardPath('fire', f.id),
    title: f.area ?? f.title,
    description: clean(f.callToAction) ?? clean(f.status),
    publisher: 'Queensland Fire Department',
    handle: null,
    kind: f.kind?.includes('PERMITTED') ? 'Planned burn' : f.level === 'Information' ? 'Bushfire' : 'Bushfire warning',
    level: levelOf(f.levelText),
    when: stamp('Issued', f.issued ?? f.published),
    place: clean(f.location),
    lane: LANE.fire,
    credit: 'Queensland Fire Department, CC BY 4.0',
  }
}

export function warningCard(w: QldWarning): ShareCard {
  return {
    path: cardPath('warning', w.id),
    title: w.area ?? w.title,
    description: clean(w.callToAction) ?? clean(w.header),
    publisher: w.from ?? 'Queensland Disaster Management',
    handle: w.from ? 'via Queensland Disaster Management' : null,
    kind: w.type && w.type !== 'Other' ? `${w.type} warning` : 'Warning',
    level: levelOf(w.levelText),
    // The feed gives the issue time only as written in the title.
    when: w.issued,
    place: null,
    lane: LANE.warning,
    credit: 'Queensland Disaster Management, CC BY 4.0',
  }
}

/** A news story's card, from its first report: the headline and the summary as far as the outlet's licence allows (already cut by the news monitor). */
export function newsCard(item: NewsItem): ShareCard {
  return {
    path: cardPath('news', item.id),
    title: item.title,
    description: item.summary,
    publisher: item.publisher,
    handle: null,
    kind: item.kind === 'official' ? 'Notice' : 'News report',
    level: null,
    when: stamp('Reported', item.published),
    place: item.places[0]?.name ?? null,
    lane: item.kind === 'official' ? LANE.official : LANE.news,
    credit: item.publisher,
  }
}

/** The card for a post Roadbeat can't find (ended, withdrawn, or a source the server doesn't read): it says so rather than guess. */
export function missingCard(source: CardSource, id: string): ShareCard {
  return {
    path: cardPath(source, id),
    title: 'A post on the Roadbeat timeline',
    description: 'Open it to see what its publisher says now.',
    publisher: 'Roadbeat',
    handle: null,
    kind: 'Timeline',
    level: null,
    when: null,
    place: null,
    lane: LANE.road,
    credit: 'Official Queensland sources',
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const shorten = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`)

/** The one-line summary under a card's title in previews. */
export function cardDescription(c: ShareCard): string {
  return shorten([c.publisher + (c.handle ? ` (${c.handle})` : ''), c.kind, c.level?.text, c.description, c.place, c.when].filter(Boolean).join(' · '), 200)
}

/**
 * The page link previews read for a timeline post: its title, summary and card
 * image, and for anyone who lands here, a straight redirect to the post.
 */
export function cardSharePage(origin: string, c: ShareCard, image: string): string {
  const url = `${origin}${c.path}`
  const title = `${c.title} · ${c.publisher} · Roadbeat`
  const description = cardDescription(c)
  const tags = [
    ['og:type', 'article'],
    ['og:site_name', 'Roadbeat'],
    ['og:title', title],
    ['og:description', description],
    ['og:url', url],
    ['og:image', image],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['og:image:alt', `${c.publisher}: ${c.title}. ${description}`],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', image],
  ]
    .map(([k, v]) => `<meta ${k.startsWith('og:') ? 'property' : 'name'}="${k}" content="${escapeHtml(v)}">`)
    .join('\n')
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
${tags}
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}">
</head>
<body>
<p><a href="${escapeHtml(url)}">Open this post on Roadbeat</a></p>
</body>
</html>
`
}
