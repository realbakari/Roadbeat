import type { EventType, TrafficEvent } from '../api/types.js'
import { brisbaneDateOnly } from './aest.js'

// When QLDTraffic itself has gone quiet on an event. Both signals are
// QLDTraffic's own fields: its last update, and the next inspection it
// scheduled. Neither says the event has cleared, and nothing here guesses that.

/**
 * Unplanned events change as crews report them, so a long silence is worth
 * saying. Roadworks and special events run to a published schedule instead,
 * and are flagged only when a scheduled check has passed with no update since.
 */
const UNPLANNED = new Set<EventType>(['Crash', 'Hazard', 'Congestion', 'Flooding'])

/** How long an unplanned event can go without an update before the list says so. */
export const QUIET_AFTER_DAYS = 7

const DAY_MS = 86_400_000

export interface UpdateGap {
  /** Whole days since QLDTraffic last updated an unplanned event, once that's QUIET_AFTER_DAYS or more. */
  days: number | null
  /** When QLDTraffic's scheduled next inspection was, once that has passed with no update since. */
  checkDue: number | null
}

/** What to say about an event QLDTraffic hasn't kept up, or null when it has. */
export function updateGap(e: TrafficEvent, now: number): UpdateGap | null {
  const p = e.properties
  const updated = p.last_updated ? Date.parse(p.last_updated) : NaN
  const days = UNPLANNED.has(p.event_type) && Number.isFinite(updated) ? Math.floor((now - updated) / DAY_MS) : null
  const next = p.next_inspection ? Date.parse(p.next_inspection) : NaN
  const gap: UpdateGap = {
    days: days != null && days >= QUIET_AFTER_DAYS ? days : null,
    // Only while nothing has been published since: an update after the date means QLDTraffic did look again.
    checkDue: Number.isFinite(next) && next < now && !(updated >= next) ? next : null,
  }
  return gap.days != null || gap.checkDue != null ? gap : null
}

/** "Not updated by QLDTraffic for 12 days · Next inspection was due 30 Sept 2026", in Brisbane dates. */
export function updateGapText(gap: UpdateGap): string {
  return [
    gap.days != null && `Not updated by QLDTraffic for ${gap.days} days`,
    gap.checkDue != null && `Next inspection was due ${brisbaneDateOnly.format(gap.checkDue)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
