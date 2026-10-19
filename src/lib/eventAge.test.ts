import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { roadEvent } from '../test/fixtures'
import { QUIET_AFTER_DAYS, updateGap, updateGapText } from './eventAge'

const now = Date.parse('2026-10-19T12:00:00+10:00')
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString()

const event = (type: TrafficEvent['properties']['event_type'], last_updated: string | null, next_inspection: string | null = null): TrafficEvent => {
  const e = roadEvent(1, 'Bruce Highway', 'Gympie', { event_type: type })
  return { ...e, properties: { ...e.properties, last_updated, next_inspection } }
}

describe('updateGap', () => {
  it('flags an unplanned event QLDTraffic hasn’t updated for a week or more, in whole days', () => {
    expect(updateGap(event('Hazard', daysAgo(45.5)), now)).toEqual({ days: 45, checkDue: null })
    expect(updateGap(event('Flooding', daysAgo(QUIET_AFTER_DAYS)), now)?.days).toBe(QUIET_AFTER_DAYS)
    expect(updateGap(event('Crash', daysAgo(QUIET_AFTER_DAYS - 0.5)), now)).toBeNull()
  })

  it('never flags planned works for age alone, only for a scheduled inspection that has passed', () => {
    expect(updateGap(event('Roadworks', daysAgo(90)), now)).toBeNull()
    const due = '2026-09-30T15:00:00+10:00'
    expect(updateGap(event('Roadworks', daysAgo(90), due), now)).toEqual({ days: null, checkDue: Date.parse(due) })
    expect(updateGap(event('Roadworks', daysAgo(90), '2027-01-01T00:00:00+10:00'), now)).toBeNull()
  })

  it('doesn’t count an inspection as missed when QLDTraffic updated the event after it', () => {
    expect(updateGap(event('Roadworks', daysAgo(13), daysAgo(200)), now)).toBeNull()
    expect(updateGap(event('Hazard', daysAgo(13), daysAgo(200)), now)).toEqual({ days: 13, checkDue: null })
  })

  it('says nothing when the times are missing or unreadable', () => {
    expect(updateGap(event('Hazard', null), now)).toBeNull()
    expect(updateGap(event('Hazard', 'not a date', 'nor this'), now)).toBeNull()
  })
})

describe('updateGapText', () => {
  it('states only what QLDTraffic published, with the date in Brisbane time', () => {
    expect(updateGapText({ days: 12, checkDue: Date.parse('2026-09-30T23:30:00Z') })).toBe('Not updated by QLDTraffic for 12 days · Next inspection was due 1 Oct 2026')
  })
})
