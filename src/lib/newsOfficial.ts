import type { FireWarning } from '../api/bushfires'
import type { TrafficEvent } from '../api/types'
import { isUpcoming } from './eventStatus'
import type { NewsStory } from './newsStories'

/** What official feeds report right now at the places a news story names. */
export interface OfficialNow {
  /** QLDTraffic road events in effect whose locality is one of the story's places. */
  events: TrafficEvent[]
  /** QFD warnings and incidents whose area, title or location names one of the story's places. */
  fires: FireWarning[]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A pattern matching any of the place names as a whole word, whatever its case. */
export function placePattern(names: string[]): RegExp {
  return new RegExp(`\\b(${names.map(escape).join('|')})\\b`, 'i')
}

/**
 * Whether a road event in effect is filed under one of the places (lower-cased
 * names). QLDTraffic files some events under two localities ("Cainbable /
 * Kerry"); either counts.
 */
export function eventAtPlaces(e: TrafficEvent, lowerNames: Set<string>, now: number): boolean {
  return !isUpcoming(e, now) && (e.properties.road_summary?.locality ?? '').split(' / ').some((l) => lowerNames.has(l.trim().toLowerCase()))
}

/** Whether a QFD warning's area, title or location names a place the pattern matches. */
export function fireNamesPlace(f: FireWarning, named: RegExp): boolean {
  return [f.area, f.title, f.location].some((t) => t && named.test(t))
}

/**
 * Official reports at a story's gazetteer places, matched by name alone, never
 * by distance. These are reports at the same places, not a claim that they are
 * the incident the story describes.
 */
export function officialNow(story: NewsStory, events: TrafficEvent[], fires: FireWarning[], now: number): OfficialNow {
  const names = story.places.filter((p) => p.via === 'gazetteer').map((p) => p.name)
  if (!names.length) return { events: [], fires: [] }
  const lower = new Set(names.map((n) => n.toLowerCase()))
  const named = placePattern(names)
  return {
    events: events.filter((e) => eventAtPlaces(e, lower, now)),
    fires: fires.filter((f) => fireNamesPlace(f, named)),
  }
}
