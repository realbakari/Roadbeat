import { describe, expect, it } from 'vitest'
import { delayOf, minutesUntil } from './timeFormat'

describe('minutesUntil', () => {
  const now = Date.parse('2026-10-15T08:00:00+10:00')
  it('counts down for the next hour', () => {
    expect(minutesUntil(now + 5 * 60_000, now)).toBe('5 min')
    expect(minutesUntil(now + 20_000, now)).toBe('Now')
    expect(minutesUntil(now - 60_000, now)).toBe('Now')
  })
  it('gives no countdown an hour or more away', () => {
    expect(minutesUntil(now + 60 * 60_000, now)).toBeNull()
  })
})

describe('delayOf', () => {
  it('is the reported time minus the published time, in seconds', () => {
    expect(delayOf(1_000_120_000, 1_000_000_000)).toBe(120)
    expect(delayOf(null, 1_000_000_000)).toBeNull()
  })
})
