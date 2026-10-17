import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, filtersKey } from './filters'

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
