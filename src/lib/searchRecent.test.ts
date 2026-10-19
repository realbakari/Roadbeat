import { describe, expect, it } from 'vitest'
import type { SearchHit } from './search'
import { matchRuns, RECENT_MAX, withRecent } from './searchRecent'

const hit = (href: string): SearchHit => ({ kind: 'town', title: href, detail: '', href })

describe('withRecent', () => {
  it('puts the newest first, drops an older copy, and keeps at most RECENT_MAX', () => {
    expect(withRecent([hit('a'), hit('b')], hit('b')).map((h) => h.href)).toEqual(['b', 'a'])
    const many = Array.from({ length: RECENT_MAX }, (_, i) => hit(String(i)))
    expect(withRecent(many, hit('new'))).toHaveLength(RECENT_MAX)
  })
})

describe('matchRuns', () => {
  it('marks the beginning of each word a query word starts', () => {
    expect(matchRuns('Goodna rest area', ['good', 'rest'])).toEqual([
      { text: 'Good', match: true },
      { text: 'na', match: false },
      { text: ' ', match: false },
      { text: 'rest', match: true },
      { text: ' ', match: false },
      { text: 'area', match: false },
    ])
  })

  it('ignores case and accents, and leaves a title without matches whole', () => {
    expect(matchRuns('Réserve', ['res']).filter((r) => r.match).map((r) => r.text)).toEqual(['Rés'])
    expect(matchRuns('Bruce Highway', [])).toEqual([{ text: 'Bruce Highway', match: false }])
  })
})
