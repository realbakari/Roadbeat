import { FIRE_LEVELS, type FireLevel, type FireWarning } from '../api/bushfires'
import { alertActive, alertNextStart, type TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { brisbaneDayDateTime } from './aest'
import { describeChange, eventHeadline, eventSignature, fireMatches, matchesRules, newsMatches, watchedRoutesIn, type AlertSettings } from './alertRules'
import { eventTitle } from './eventText'
import { publisherList, type NewsStory } from './newsStories'

// What changed between one read of a feed and the next, as the notifications
// it raises. Each takes what was seen last time and what the feed lists now;
// `away` marks alerts raised for changes made while the app was closed, which
// are capped so a long absence doesn't flood the notification centre.

export interface AppNotification {
  id: string
  kind: 'event-new' | 'event-update' | 'event-cleared' | 'transit' | 'fire' | 'news'
  title: string
  body: string
  at: number
  /** Hash route to open, e.g. "event/123". */
  href: string | null
  tone: 'error' | 'warning' | 'info' | 'success'
  read: boolean
  /** Raised while the app was closed; shown in the centre but not toasted. */
  away?: boolean
}

export type Notice = Omit<AppNotification, 'read'>

/** Each event's id and signature, for telling next time whether it changed. */
export function eventSignatures(events: TrafficEvent[]): Record<string, string> {
  const sigs: Record<string, string> = {}
  for (const e of events) sigs[e.properties.id] = eventSignature(e)
  return sigs
}

/** Road events: new ones the rules match or the user watches, changes to watched ones, and watched ones no longer listed. */
export function eventNotices(prev: Record<string, string>, events: TrafficEvent[], s: AlertSettings, now: number, away: boolean): Notice[] {
  const sigs = eventSignatures(events)
  const out: Notice[] = []
  const watched = new Set(s.watchedEvents)
  for (const e of events) {
    const id = String(e.properties.id)
    if (!(id in prev)) {
      if (watched.has(e.properties.id) || matchesRules(e, s, now)) {
        const h = eventHeadline(e)
        const severe = e.properties.event_type === 'Crash' || e.properties.event_priority === 'Red Alert'
        out.push({ id: `new-${id}-${now}`, kind: 'event-new', ...h, at: now, href: `event/${id}`, tone: severe ? 'error' : 'warning', away })
      }
    } else if (watched.has(e.properties.id) && prev[id] !== sigs[id]) {
      out.push({
        id: `upd-${id}-${now}`,
        kind: 'event-update',
        title: `${describeChange(prev[id], e)} · ${eventTitle(e)}`,
        body: eventHeadline(e).body,
        at: now,
        href: `event/${id}`,
        tone: e.properties.status === 'Reopened' ? 'success' : 'info',
        away,
      })
    }
  }
  for (const id of s.watchedEvents) {
    if (String(id) in prev && !(String(id) in sigs)) {
      out.push({
        id: `clr-${id}-${now}`,
        kind: 'event-cleared',
        title: 'Event cleared',
        body: `A road event you were watching (#${id}) is no longer listed by QLDTraffic.`,
        at: now,
        href: null,
        tone: 'success',
        away,
      })
    }
  }
  return away ? out.slice(0, 20) : out
}

/** TransLink alerts not seen before that name a watched route or line. */
export function transitNotices(prev: string[], alerts: TransitAlert[], routes: string[], now: number, away: boolean): Notice[] {
  const known = new Set(prev)
  return alerts
    .filter((a) => !known.has(a.id))
    .flatMap((a) => {
      const hit = watchedRoutesIn(a, routes)
      if (!hit.length) return []
      const next = alertActive(a, now) ? null : alertNextStart(a, now)
      return [
        {
          id: `tl-${a.id}`,
          kind: 'transit' as const,
          title: `${hit.join(', ')}: ${a.header}`,
          body: next ? `Starts ${brisbaneDayDateTime.format(next)}. ${a.effect}.` : `${a.effect}. ${a.description}`,
          at: now,
          href: `transit/alert/${encodeURIComponent(a.id)}`,
          tone: 'warning' as const,
          away,
        },
      ]
    })
}

/** Each warning's id and level, for telling next time whether it rose. */
export function fireLevels(fires: FireWarning[]): Record<string, string> {
  const levels: Record<string, string> = {}
  for (const f of fires) levels[f.id] = f.level
  return levels
}

/** Queensland Fire Department warnings the rules match: new ones, and ones whose level went up. */
export function fireNotices(prev: Record<string, string>, fires: FireWarning[], s: AlertSettings, now: number, away: boolean): Notice[] {
  const out: Notice[] = []
  for (const f of fires) {
    if (!fireMatches(f, s)) continue
    const was = prev[f.id]
    const rose = was != null && FIRE_LEVELS.indexOf(f.level) < FIRE_LEVELS.indexOf(was as FireLevel)
    if (was != null && !rose) continue
    out.push({
      id: `fire-${f.id}-${f.level}`,
      kind: 'fire',
      title: `${rose ? 'Now ' : ''}${f.levelText}: ${f.area ?? f.title}`,
      body: [f.callToAction, f.header].filter(Boolean).join(' — ') || f.title,
      at: now,
      href: `fire/${encodeURIComponent(f.id)}`,
      tone: f.level === 'Advice' ? 'warning' : 'error',
      away,
    })
  }
  return away ? out.slice(0, 10) : out
}

/** News monitor stories not seen before that the rules match. A report joining a known story isn't news to the user. */
export function newsNotices(prev: string[], stories: NewsStory[], s: AlertSettings, now: number, away: boolean): Notice[] {
  const known = new Set(prev)
  return stories
    .filter((st) => !known.has(st.id) && newsMatches(st, s))
    .slice(0, away ? 10 : 5)
    .map((st) => ({
      id: `news-${st.id}`,
      kind: 'news' as const,
      title: st.kind === 'official' ? `${st.publishers[0]}: ${st.items[0].title}` : st.items[0].title,
      body: st.kind === 'official' ? (st.items[0].summary ?? 'Official notice.') : `News report. Reported by ${publisherList(st.publishers)}.`,
      at: now,
      href: `news/${encodeURIComponent(st.id)}`,
      tone: st.kind === 'official' ? ('warning' as const) : ('info' as const),
      away,
    }))
}
