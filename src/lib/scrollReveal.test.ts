import { describe, expect, it } from 'vitest'
import { nextHidden, REVEAL_TOP } from './scrollReveal'

describe('nextHidden', () => {
  it('hides when scrolling down past the top', () => {
    expect(nextHidden(false, 200, 150)).toBe(true)
  })
  it('shows on any clear scroll up', () => {
    expect(nextHidden(true, 400, 420)).toBe(false)
  })
  it('always shows near the top', () => {
    expect(nextHidden(true, REVEAL_TOP - 1, 0)).toBe(false)
  })
  it('keeps its state for tiny movements', () => {
    expect(nextHidden(true, 300, 297)).toBe(true)
    expect(nextHidden(false, 300, 303)).toBe(false)
  })
})
