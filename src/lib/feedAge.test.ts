import { describe, expect, it } from 'vitest'
import { isStale, STALE_AFTER_MS } from './feedAge'

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
