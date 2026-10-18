import { BRISBANE_OFFSET_MS } from './aest'

// Parts of a stop's day, for scanning its published timetable, and the last
// service of the day on each route. Both come straight from published times.

export type TimeBand = 'am' | 'pm' | 'night'

/** Each band's Brisbane hours: morning 4am–noon, afternoon noon–7pm, night 7pm–4am. */
export const TIME_BANDS: { band: TimeBand; label: string; hours: string }[] = [
  { band: 'am', label: 'AM', hours: '4am to noon' },
  { band: 'pm', label: 'PM', hours: 'noon to 7pm' },
  { band: 'night', label: 'Night', hours: '7pm to 4am' },
]

/** The band a time falls in, by its Brisbane clock hour (Queensland has no daylight saving). */
export function bandOf(t: number): TimeBand {
  const h = Math.floor((t + BRISBANE_OFFSET_MS) / 3_600_000) % 24
  return h >= 4 && h < 12 ? 'am' : h >= 12 && h < 19 ? 'pm' : 'night'
}

/**
 * Keys of the last departure in `list` in each `group` (such as service day,
 * line and destination): the "Last" badge. `list` should hold every published
 * departure of those days at one stop, so the last one is the last the
 * timetable publishes, not just the last shown.
 */
export function lastServices<T>(list: T[], group: (d: T) => string, time: (d: T) => number, key: (d: T) => string): Set<string> {
  const last = new Map<string, T>()
  for (const d of list) {
    const g = group(d)
    const prev = last.get(g)
    if (!prev || time(d) >= time(prev)) last.set(g, d)
  }
  return new Set([...last.values()].map(key))
}
