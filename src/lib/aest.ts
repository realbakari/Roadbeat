// Times as Queensland reads them. Queensland keeps AEST all year (no daylight
// saving), so every time the app shows for a time-based layer says AEST.

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })
const dayClock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', hour: 'numeric', minute: '2-digit' })
const brisbaneDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })

/** A time in Queensland's zone, AEST (Queensland has no daylight saving), with the weekday when it isn't today. */
export function aestTime(at: number, now: number): string {
  const sameDay = brisbaneDay.format(at) === brisbaneDay.format(now)
  return `${(sameDay ? clock : dayClock).format(at)} AEST`
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
