import type { TrafficEvent } from '../api/types.js'
import { clean } from './format.js'

export function eventTitle(e: TrafficEvent): string {
  const p = e.properties
  return clean(p.road_summary?.road_name) ?? clean(p.event_subtype) ?? p.event_type
}

export function eventPlace(e: TrafficEvent): string {
  const r = e.properties.road_summary
  return [clean(r?.locality), clean(r?.district)].filter(Boolean).join(' · ')
}

/** Directions QLDTraffic publishes that say nothing about which way. */
const NO_DIRECTION = new Set(['Unknown'])

/**
 * One line for a list row: the published impact, direction and delay, in that
 * order, e.g. "Road closed to all traffic · Southbound towards Rosewood ·
 * Delays expected". Each part is QLDTraffic's own wording; parts it leaves
 * blank are left out, and null means it published none of them.
 */
export function impactLine(e: TrafficEvent): string | null {
  const i = e.properties.impact
  if (!i) return null
  const direction = clean(i.direction)
  const towards = clean(i.towards)
  const way = [direction && !NO_DIRECTION.has(direction) ? direction : null, towards && `towards ${towards}`].filter(Boolean).join(' ')
  const parts = [clean(i.impact_subtype) ?? clean(i.impact_type), way || null, clean(i.delay)].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
