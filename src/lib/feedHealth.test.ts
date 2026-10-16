import { describe, expect, it } from 'vitest'
import { cadenceLabel, groupByPublisher, isProxyError, readLabel, summarise, type FeedOutcome } from './feedHealth'

describe('summarise', () => {
  it('counts each outcome', () => {
    const outcomes: FeedOutcome[] = [
      { kind: 'ok', checkedAt: 1, publisherTime: null, sources: null },
      { kind: 'ok', checkedAt: 1, publisherTime: null, sources: null },
      { kind: 'failed', checkedAt: 1, error: 'x', needsProxy: false },
      { kind: 'unchecked', reason: 'Not checked yet' },
    ]
    expect(summarise(outcomes)).toEqual({ ok: 2, failed: 1, unchecked: 1 })
  })
})

describe('groupByPublisher', () => {
  it('keeps registry order within and between publishers', () => {
    const groups = groupByPublisher([
      { id: 'a', publisher: 'TMR' },
      { id: 'b', publisher: 'BCC' },
      { id: 'c', publisher: 'TMR' },
    ])
    expect(groups.map((g) => g.publisher)).toEqual(['TMR', 'BCC'])
    expect(groups[0].feeds.map((f) => f.id)).toEqual(['a', 'c'])
  })
})

describe('labels', () => {
  it('writes cadences in the docs units', () => {
    expect(cadenceLabel(15)).toBe('15 s')
    expect(cadenceLabel(300)).toBe('5 min')
    expect(cadenceLabel(6 * 3600)).toBe('6 h')
  })

  it('names the read path', () => {
    expect(readLabel('direct', null)).toBe('Direct')
    expect(readLabel('proxy', '/translink-rt')).toBe('Proxy /translink-rt')
    expect(readLabel('server', '/api/news')).toBe('Server /api/news')
  })

  it('recognises the fetch functions’ proxy message', () => {
    expect(isProxyError('TransLink proxy is not configured')).toBe(true)
    expect(isProxyError('TransLink responded with 502')).toBe(false)
  })
})
