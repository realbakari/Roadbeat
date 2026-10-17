import { describe, expect, it } from 'vitest'
import { roadEvent } from '../test/fixtures'
import { DEFAULT_FILTERS, filtersKey, isCurrent, matchesBase } from './filters'

describe('filtersKey', () => {
  it('ignores sort order and the order types were picked in', () => {
    const a = { ...DEFAULT_FILTERS, types: new Set(['Crash', 'Flooding'] as const) }
    const b = { ...DEFAULT_FILTERS, types: new Set(['Flooding', 'Crash'] as const), sort: 'nearest' as const }
    expect(filtersKey(a)).toBe(filtersKey(b))
  })

  it('changes with the search and each filter', () => {
    const base = filtersKey(DEFAULT_FILTERS)
    expect(filtersKey({ ...DEFAULT_FILTERS, query: 'M1' })).not.toBe(base)
    expect(filtersKey({ ...DEFAULT_FILTERS, closuresOnly: true })).not.toBe(base)
    expect(filtersKey({ ...DEFAULT_FILTERS, district: 'Metropolitan' })).not.toBe(base)
  })
})

describe('matchesBase', () => {
  const now = Date.UTC(2026, 9, 17, 2)
  const ended = roadEvent(1, 'Bruce Highway', 'Burpengary', {
    event_type: 'Hazard',
    duration: { start: '2026-10-10T00:00:00+10:00', end: '2026-10-15T00:00:00+10:00', active_days: null, recurrences: null },
  })

  it('files an event past its end under Upcoming, as the official site and dashboard count it', () => {
    expect(isCurrent(ended, now)).toBe(false)
    expect(matchesBase(ended, DEFAULT_FILTERS, now)).toBe(false)
    expect(matchesBase(ended, { ...DEFAULT_FILTERS, when: 'upcoming' }, now)).toBe(true)
  })
})
