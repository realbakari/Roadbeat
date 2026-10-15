import type { TrafficEvent } from '../api/types'
import { clean } from './format'

export function eventTitle(e: TrafficEvent): string {
  const p = e.properties
  return clean(p.road_summary?.road_name) ?? clean(p.event_subtype) ?? p.event_type
}

export function eventPlace(e: TrafficEvent): string {
  const r = e.properties.road_summary
  return [clean(r?.locality), clean(r?.district)].filter(Boolean).join(' · ')
}
