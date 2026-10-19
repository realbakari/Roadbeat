import { describe, expect, it } from 'vitest'
import { feedAnnouncement, feedStatus, isStale, STALE_AFTER_MS } from './feedAge'

describe('isStale', () => {
  const at = Date.UTC(2026, 9, 17, 0, 0)

  it('is false before the first good read', () => {
    expect(isStale(null, true, at)).toBe(false)
  })

  it('is true as soon as a read fails', () => {
    expect(isStale(at, true, at + 1_000)).toBe(true)
  })

  it('is true once the feed has been quiet for too long', () => {
    expect(isStale(at, false, at + STALE_AFTER_MS)).toBe(false)
    expect(isStale(at, false, at + STALE_AFTER_MS + 1)).toBe(true)
  })
})

describe('feedAnnouncement', () => {
  it('stays the same across refreshes, so nothing is re-announced', () => {
    expect(feedAnnouncement(null, 1_000)).toBe(feedAnnouncement(null, 61_000))
  })

  it('changes when the feed fails and when it recovers', () => {
    expect(feedAnnouncement(null, null)).toBe('')
    expect(feedAnnouncement('Timed out', 1_000)).toBe('Road events delayed')
    expect(feedAnnouncement(null, 2_000)).toBe('Road events live')
  })
})

describe('feedStatus', () => {
  const at = Date.UTC(2026, 9, 17, 0, 0)

  it('says when road events were updated, and that they are delayed when a read fails', () => {
    expect(feedStatus(null, null, at)).toBe('Connecting…')
    expect(feedStatus('down', null, at)).toBe('Road events delayed')
    expect(feedStatus(null, at, at + 120_000)).toMatch(/^Updated /)
    expect(feedStatus('down', at, at + 120_000)).toMatch(/^Delayed, updated /)
  })
})
