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
