import { describe, expect, it } from 'vitest'
import { ageText, aestTime, aestWithAge, BRISBANE_OFFSET_MS, brisbaneClock, brisbaneDate, brisbaneDateOnly, brisbaneDayClock, brisbaneDayDateTime, brisbaneDayKey, brisbaneWeekday } from './aest'

const NOW = Date.parse('2026-10-17T13:34:00Z')

describe('aest', () => {
  it('writes a time in AEST, with its age', () => {
    expect(aestWithAge(Date.parse('2026-10-17T13:20:00Z'), NOW)).toBe('11:20 pm AEST, 14 min ago')
  })
  it('adds the weekday for an image from another Queensland day', () => {
    expect(aestTime(Date.parse('2026-10-17T13:50:00Z'), Date.parse('2026-10-17T14:05:00Z'))).toBe('Sat 11:50 pm AEST')
  })
  it('counts age in minutes, then hours', () => {
    expect(ageText(NOW - 20_000, NOW)).toBe('just now')
    expect(ageText(NOW - 60 * 60_000, NOW)).toBe('1 h ago')
    expect(ageText(NOW - 65 * 60_000, NOW)).toBe('1 h 5 min ago')
  })
  it('takes the Queensland calendar date, which starts at 2 pm UTC', () => {
    expect(brisbaneDate(Date.parse('2026-10-16T13:59:00Z'))).toBe('2026-10-16')
    expect(brisbaneDate(Date.parse('2026-10-16T14:00:00Z'))).toBe('2026-10-17')
    expect(BRISBANE_OFFSET_MS).toBe(36_000_000)
  })
  it('formats in Brisbane time whatever zone the device is in', () => {
    const t = Date.parse('2026-10-17T06:05:00Z')
    expect(brisbaneClock.format(t)).toBe('4:05 pm')
    expect(brisbaneDayClock.format(t)).toBe('Sat 4:05 pm')
    expect(brisbaneDayDateTime.format(t)).toBe('Sat, 17 Oct, 4:05 pm')
    expect(brisbaneWeekday.format(t)).toBe('Sat')
    expect(brisbaneDateOnly.format(t)).toBe('17 Oct 2026')
    expect(brisbaneDayKey.format(Date.parse('2026-10-16T14:00:00Z'))).toBe('2026-10-17')
  })
})
