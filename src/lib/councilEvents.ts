import type { CouncilEvent } from '../api/bccDashboard'

const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
const DAY = 86_400_000

/** Brisbane midnight that starts the day containing `t`. */
export function brisbaneMidnight(t: number): number {
  return Date.parse(`${day.format(t)}T00:00:00+10:00`)
}

/** The window the map's Events layer shows: today and the next 7 days, Brisbane time. */
export function eventsWeek(now: number): { from: number; to: number } {
  const from = brisbaneMidnight(now)
  return { from, to: from + 8 * DAY }
}

/**
 * Events with a map position that are on at some point between `from` and
 * `to`: starting inside the window, or started earlier and not yet finished.
 */
export function eventsOn(list: CouncilEvent[], from: number, to: number): CouncilEvent[] {
  return list.filter((e) => e.position && e.start < to && (e.end ?? e.start) >= from)
}

/**
 * A stable id for an event: Trumba's eventid from the council's link, else a
 * hash of the title and start, since the dataset publishes no id of its own.
 */
export function councilEventId(webLink: string | null | undefined, subject: string, start: string): string {
  const m = webLink?.match(/eventid(?:%3D|=)(\d+)/i)
  if (m) return m[1]
  let h = 5381
  for (const c of `${subject.trim()}|${start}`) h = (h * 33) ^ (c.codePointAt(0) ?? 0)
  return `h${(h >>> 0).toString(36)}`
}
