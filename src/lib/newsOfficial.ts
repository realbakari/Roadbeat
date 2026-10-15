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

/**
 * Official reports at a story's gazetteer places, matched by name alone, never
 * by distance. QLDTraffic files some events under two localities ("Cainbable /
 * Kerry"); either counts. These are reports at the same places, not a claim
 * that they are the incident the story describes.
 */
export function officialNow(story: NewsStory, events: TrafficEvent[], fires: FireWarning[], now: number): OfficialNow {
  const names = story.places.filter((p) => p.via === 'gazetteer').map((p) => p.name)
  if (!names.length) return { events: [], fires: [] }
  const lower = new Set(names.map((n) => n.toLowerCase()))
  const named = new RegExp(`\\b(${names.map(escape).join('|')})\\b`, 'i')
  return {
    events: events.filter(
      (e) => !isUpcoming(e, now) && (e.properties.road_summary?.locality ?? '').split(' / ').some((l) => lower.has(l.trim().toLowerCase())),
    ),
    fires: fires.filter((f) => [f.area, f.title, f.location].some((t) => t && named.test(t))),
  }
}
