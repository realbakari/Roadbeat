import { describe, expect, it } from 'vitest'
import { FEEDS } from './feedRegistry'

describe('FEEDS', () => {
  it('names a publisher, an address and a licence for every feed', () => {
    for (const f of FEEDS) {
      expect(f.url, f.id).not.toBe('')
      expect(f.publisher, f.id).not.toBe('')
      expect(f.licence, f.id).not.toBe('')
      expect(f.name, f.id).not.toBe('')
      expect(f.module, f.id).not.toBe('')
      expect(f.feeds.length, f.id).toBeGreaterThan(0)
    }
  })

  it('gives every feed its own id', () => {
    const ids = FEEDS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names the app path for every proxied or server-read feed, and none for a direct one', () => {
    for (const f of FEEDS) {
      if (f.read === 'direct') expect(f.path, f.id).toBeNull()
      else expect(f.path, f.id).toMatch(/^\//)
    }
  })

  it('says when a feed without a cadence is read', () => {
    for (const f of FEEDS) {
      if (f.refreshSeconds == null) expect(f.refreshNote, f.id).toBeTruthy()
      else expect(f.refreshSeconds, f.id).toBeGreaterThan(0)
    }
  })
})
