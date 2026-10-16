import { describe, expect, it } from 'vitest'
import { startLabel } from './eventStatus'

const NOW = Date.parse('2026-10-16T12:00:00+10:00')

describe('startLabel', () => {
  it('says a start still to come starts, and one that has passed started', () => {
    expect(startLabel('2026-10-22T06:00:00+10:00', NOW)).toBe('Starts')
    expect(startLabel('2026-10-16T06:00:00+10:00', NOW)).toBe('Started')
    expect(startLabel(null, NOW)).toBe('Started')
  })
})
