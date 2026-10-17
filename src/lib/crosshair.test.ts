import { describe, expect, it } from 'vitest'
import { crosshairItems, formatPosition } from './crosshair'

describe('formatPosition', () => {
  it('writes degrees with hemispheres', () => {
    expect(formatPosition([153.0251, -27.4698])).toBe('27.4698° S, 153.0251° E')
  })
})

describe('crosshairItems', () => {
  it('lists each labelled item once and skips unlabelled ones', () => {
    expect(
      crosshairItems([
        { label: 'Roadworks · Bruce Hwy', key: 'event/1' },
        { label: 'Roadworks · Bruce Hwy', key: 'event/1' },
        { label: '', key: 'x' },
        { key: 'y' },
        { label: 'Traffic camera · Gateway', key: null },
      ]),
    ).toEqual([
      { label: 'Roadworks · Bruce Hwy', key: 'event/1' },
      { label: 'Traffic camera · Gateway', key: null },
    ])
  })

  it('stops at the limit', () => {
    expect(crosshairItems(Array.from({ length: 10 }, (_, i) => ({ label: `x${i}`, key: `k${i}` })), 3)).toHaveLength(3)
  })
})
