import type { FireWarning } from '../api/bushfireFeed'
import type { QldWarning } from '../api/qldWarnings'
import type { TrafficEvent } from '../api/types'
import { isClosure, isCurrent } from './eventStatus'
import { eventTitle } from './eventText'
import { clean } from './format'

// What the strip under the header leads with: the most serious item any
// official feed publishes right now, and the counts behind it. Nothing is
// ranked by Roadbeat's own judgement: the order is the publishers' own levels.

/** The levels that make the strip, highest first: the warning system's top two, and QLDTraffic's top priority. */
export const MAJOR_LEVELS = ['Emergency Warning', 'Red Alert', 'Watch and Act'] as const
export type MajorLevel = (typeof MAJOR_LEVELS)[number]

export interface MajorItem {
  level: MajorLevel
  /** The level as the publisher writes it. */
  levelText: string
  title: string
  /** Hash route to open it. */
  href: string
}

export interface MajorSummary {
  /** Every item at a major level, highest first. */
  items: MajorItem[]
  /** Storm, flood, cyclone and bushfire warnings at any level, or null until both feeds have loaded. */
  warnings: number | null
  /** Current road closures and Red Alerts, or null until road events have loaded. */
  closures: number | null
  redAlerts: number | null
}

interface Sources {
  /** Null until the first read. */
  events: TrafficEvent[] | null
  fires: FireWarning[] | null
  warnings: QldWarning[] | null
  now: number
}

const isMajor = (level: string): level is MajorLevel => (MAJOR_LEVELS as readonly string[]).includes(level)

export function majorIncidents({ events, fires, warnings, now }: Sources): MajorSummary {
  const current = events?.filter((e) => isCurrent(e, now)) ?? null
  const items: MajorItem[] = []
  for (const w of warnings ?? []) {
    if (isMajor(w.level)) items.push({ level: w.level, levelText: w.levelText, title: w.area ?? w.title, href: `place/warning/${encodeURIComponent(w.id)}` })
  }
  for (const f of fires ?? []) {
    if (isMajor(f.level)) items.push({ level: f.level, levelText: f.levelText, title: f.area ?? f.title, href: `fire/${encodeURIComponent(f.id)}` })
  }
  for (const e of current ?? []) {
    if (e.properties.event_priority !== 'Red Alert') continue
    const place = clean(e.properties.road_summary?.locality)
    items.push({ level: 'Red Alert', levelText: 'Red Alert', title: place ? `${eventTitle(e)}, ${place}` : eventTitle(e), href: `event/${e.properties.id}` })
  }
  // A stable sort keeps each feed's own order within a level.
  items.sort((a, b) => MAJOR_LEVELS.indexOf(a.level) - MAJOR_LEVELS.indexOf(b.level))
  return {
    items,
    warnings: warnings && fires ? warnings.length + fires.filter((f) => f.level !== 'Information').length : null,
    closures: current ? current.filter(isClosure).length : null,
    redAlerts: current ? current.filter((e) => e.properties.event_priority === 'Red Alert').length : null,
  }
}
