// Times as Queensland reads them. Queensland keeps AEST all year (no daylight
// saving), so every time the app shows for a time-based layer says AEST.
// This is the one home for Brisbane time: the offset, the calendar date and
// the formatters the app shares, so no screen forgets the time zone.

/** Queensland's fixed offset from UTC, AEST (+10:00). No daylight saving, so it never changes. */
export const BRISBANE_OFFSET_MS = 10 * 3_600_000

const TZ = 'Australia/Brisbane'

/** "4:05 pm" */
export const brisbaneClock = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
/** "Sat 4:05 pm" */
export const brisbaneDayClock = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' })
/** "Sat, 17 Oct, 4:05 pm" */
export const brisbaneDayDateTime = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
/** "Sat" */
export const brisbaneWeekday = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short' })
/** "17 Oct 2026" */
export const brisbaneDateOnly = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
/** "2026-10-17": en-CA writes dates as yyyy-mm-dd, so two instants compare by Queensland day. */
export const brisbaneDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })

/** The Queensland calendar date of an instant, as yyyy-mm-dd. */
export function brisbaneDate(t: number): string {
  return new Date(t + BRISBANE_OFFSET_MS).toISOString().slice(0, 10)
}

/** A time in Queensland's zone, AEST (Queensland has no daylight saving), with the weekday when it isn't today. */
export function aestTime(at: number, now: number): string {
  const sameDay = brisbaneDayKey.format(at) === brisbaneDayKey.format(now)
  return `${(sameDay ? brisbaneClock : brisbaneDayClock).format(at)} AEST`
}

/** How long ago `at` was, in minutes up to an hour, then hours and minutes: "14 min ago", "1 h 5 min ago". */
export function ageText(at: number, now: number): string {
  const mins = Math.max(0, Math.round((now - at) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min ago` : `${h} h ago`
}

/** A data time with its age: "11:20 pm AEST, 14 min ago". */
export function aestWithAge(at: number, now: number): string {
  return `${aestTime(at, now)}, ${ageText(at, now)}`
}
