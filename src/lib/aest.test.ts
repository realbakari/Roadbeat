import { describe, expect, it } from 'vitest'
import { ageText, aestStamp, aestTime, aestWithAge } from './aest'

const NOW = Date.parse('2026-10-17T13:34:00Z')

describe('aest', () => {
  it('writes a time in AEST, with its age', () => {
    expect(aestWithAge(Date.parse('2026-10-17T13:20:00Z'), NOW)).toBe('11:20 pm AEST, 14 min ago')
  })
  it('stamps a time with its date', () => {
    expect(aestStamp(Date.parse('2026-10-17T13:20:00Z'))).toBe('17 Oct, 11:20 pm AEST')
  })
  it('adds the weekday for an image from another Queensland day', () => {
    expect(aestTime(Date.parse('2026-10-17T13:50:00Z'), Date.parse('2026-10-17T14:05:00Z'))).toBe('Sat 11:50 pm AEST')
  })
  it('counts age in minutes, then hours', () => {
    expect(ageText(NOW - 20_000, NOW)).toBe('just now')
    expect(ageText(NOW - 60 * 60_000, NOW)).toBe('1 h ago')
    expect(ageText(NOW - 65 * 60_000, NOW)).toBe('1 h 5 min ago')
  })
})
