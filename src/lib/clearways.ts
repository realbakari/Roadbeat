import { BRISBANE_OFFSET_MS } from './aest'

// Reads the times on Brisbane City Council's clearway records, such as
// "7AM-9AM  4PM-7PM MON-FRI", "7-9AM, 4-7PM MON-SAT", "9AM-6PM M-F, 7AM-NOON SAT"
// or "AT ALL TIMES". The council types them freely, so anything this can't read
// with certainty is "unknown" and the app shows the text as published.

/** A signed window: minutes after midnight on the given weekdays (0 = Sunday). */
export interface ClearwayWindow {
  days: number[]
  start: number
  end: number
}

export type ClearwaySchedule = { kind: 'always' } | { kind: 'windows'; windows: ClearwayWindow[] } | { kind: 'unknown' }

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
const DAY: Record<string, number> = { SUN: 0, MON: 1, M: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, F: 5, SAT: 6 }

/** "MON-FRI", "M-F", "MON - SAT", "DAILY", "SAT" → weekdays. Null when the text isn't a day range. */
function parseDays(s: string): number[] | null {
  const t = s.replace(/\s+/g, '')
  if (t === '' || t === 'DAILY') return EVERY_DAY
  const range = t.match(/^([A-Z]+)-([A-Z]+)$/)
  if (range) {
    const a = DAY[range[1]]
    const b = DAY[range[2]]
    if (a == null || b == null) return null
    const out: number[] = []
    for (let d = a; ; d = (d + 1) % 7) {
      out.push(d)
      if (d === b) break
    }
    return out
  }
  return DAY[t] != null && t.length >= 3 ? [DAY[t]] : null
}

/** "7AM-9AM", "7-9AM", "3:30-7:00 PM", "7AM-NOON" → minutes. Null if it isn't one range. */
function parseRange(s: string): { start: number; end: number } | null {
  const m = s.replace(/\s+/g, '').match(/^(\d{1,2})(?:[:.](\d{2}))?(AM|PM)?-(?:(\d{1,2})(?:[:.](\d{2}))?(AM|PM)|(NOON))$/)
  if (!m) return null
  const endMer = m[7] ? 'PM' : m[6]
  const endH = m[7] ? 12 : Number(m[4])
  const endM = m[7] ? 0 : Number(m[5] ?? 0)
  const to24 = (h: number, mer: string) => (mer === 'AM' ? h % 12 : (h % 12) + 12)
  const end = m[7] ? 12 * 60 : to24(endH, endMer) * 60 + endM
  const startH = Number(m[1])
  const startM = Number(m[2] ?? 0)
  // "7-9AM" and "4-7PM": a start without AM or PM shares the end's, unless that would put it after the end ("11-2PM").
  let start = to24(startH, m[3] ?? endMer) * 60 + startM
  if (!m[3] && start >= end) start = to24(startH, 'AM') * 60 + startM
  if (startH > 12 || endH > 12 || start >= end) return null
  return { start, end }
}

/** Parses a clearway's published times. */
export function parseClearwayTimes(raw: string | null | undefined): ClearwaySchedule {
  if (!raw) return { kind: 'unknown' }
  const s = raw
    .toUpperCase()
    .replace(/\bTO\b/g, '-')
    .replace(/C?\s*TOW\s*AWAY|TOWAWAY|ALONG OVERPASS/g, '')
    .replace(/^CLEARWAY\s*(\(REPEATER\))?/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^AT ALL TIMES$/.test(s)) return { kind: 'always' }
  const windows: ClearwayWindow[] = []
  // Groups split by commas each end with their own days ("3-7PM MON-FRI, 10AM-2PM SAT");
  // a group with no days takes the next group's ("7-9AM, 4-7PM MON-SAT").
  const groups = s.split(',').map((g) => g.trim())
  let pending: { start: number; end: number }[] = []
  for (const g of groups) {
    const ranges: { start: number; end: number }[] = []
    let rest = g
    for (;;) {
      const m = rest.match(/^\s*&?\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM)?\s*-\s*(?:\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM)|NOON))/)
      if (!m) break
      const r = parseRange(m[1])
      if (!r) return { kind: 'unknown' }
      ranges.push(r)
      rest = rest.slice(m[0].length)
    }
    if (!ranges.length) return { kind: 'unknown' }
    const days = parseDays(rest.trim())
    if (!days) return { kind: 'unknown' }
    if (!rest.trim() && groups.length > 1 && g !== groups.at(-1)) {
      pending.push(...ranges)
      continue
    }
    for (const r of [...pending, ...ranges]) windows.push({ days, ...r })
    pending = []
  }
  return windows.length ? { kind: 'windows', windows } : { kind: 'unknown' }
}

/** Whether the signed times cover `now` (Brisbane time). Null when the times couldn't be read. */
export function clearwayInEffect(schedule: ClearwaySchedule, now: number): boolean | null {
  if (schedule.kind === 'always') return true
  if (schedule.kind === 'unknown') return null
  const local = new Date(now + BRISBANE_OFFSET_MS)
  const day = local.getUTCDay()
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes()
  return schedule.windows.some((w) => w.days.includes(day) && minute >= w.start && minute < w.end)
}
