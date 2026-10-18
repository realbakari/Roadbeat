import { describe, expect, it } from 'vitest'
import { timeDetail } from './relativeTime'

describe('timeDetail', () => {
  const now = Date.parse('2026-10-17T06:05:00Z') // 4:05 pm in Brisbane

  it('gives the relative label, the instant, and the exact Brisbane time', () => {
    const d = timeDetail(now - 3 * 3_600_000, now)
    expect(d).toEqual({
      label: '3 hours ago',
      iso: '2026-10-17T03:05:00.000Z',
      exact: 'Sat, 17 Oct, 1:05 pm AEST',
      spoken: '3 hours ago, Sat, 17 Oct, 1:05 pm AEST',
    })
  })

  it('reads ISO strings as well as epoch milliseconds', () => {
    expect(timeDetail('2026-10-17T06:04:50Z', now)?.label).toBe('just now')
  })

  it('returns null for a missing or unreadable time', () => {
    expect(timeDetail(null, now)).toBeNull()
    expect(timeDetail(undefined, now)).toBeNull()
    expect(timeDetail('not a date', now)).toBeNull()
  })
})
