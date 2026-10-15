import type { RoadOccupancy } from '../api/bccRoadOccupancies'

const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
const weekday = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short' })
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Whether the permit's period includes this Brisbane date (YYYY-MM-DD) and weekday. */
function runsOn(o: RoadOccupancy, date: string, dow: string) {
  if (date < o.startDate || date > o.endDate) return false
  if (o.period === 'Weekends') return dow === 'Sat' || dow === 'Sun'
  if (o.period === 'Sundays only') return dow === 'Sun'
  return true
}

/** Occupancies whose permit covers today in Brisbane, by their dates and days. */
export function occupanciesToday(list: RoadOccupancy[], now: number): RoadOccupancy[] {
  const date = day.format(now)
  const dow = weekday.format(now)
  return list.filter((o) => runsOn(o, date, dow))
}

/**
 * Whether the permit's hours include `now`. An overnight window (start after
 * finish) runs past midnight, so the early-morning part belongs to the day before.
 * This reads the permit; it can't tell whether crews are on site.
 */
export function inHoursNow(o: RoadOccupancy, now: number): boolean {
  if (o.period === 'Continuously') return runsOn(o, day.format(now), weekday.format(now))
  if (!o.startTime || !o.finishTime) return false
  const t = clock.format(now)
  const overnight = o.startTime > o.finishTime
  if (!overnight) return runsOn(o, day.format(now), weekday.format(now)) && t >= o.startTime && t < o.finishTime
  const yesterday = now - 24 * 3600_000
  return (runsOn(o, day.format(now), weekday.format(now)) && t >= o.startTime) || (runsOn(o, day.format(yesterday), weekday.format(yesterday)) && t < o.finishTime)
}

/** Full closures first, then permits in their hours now, then by road. */
export function sortOccupancies(list: RoadOccupancy[], now: number): RoadOccupancy[] {
  const full = (o: RoadOccupancy) => /full closure/i.test(o.closure)
  return [...list].sort(
    (a, b) => Number(full(b)) - Number(full(a)) || Number(inHoursNow(b, now)) - Number(inHoursNow(a, now)) || a.road.localeCompare(b.road),
  )
}

/** Whether an occupancy mentions every word of a search, in its roads or suburb. */
export function occupancyMatches(o: RoadOccupancy, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const hay = [o.road, o.from, o.to, o.suburb].filter(Boolean).join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}
