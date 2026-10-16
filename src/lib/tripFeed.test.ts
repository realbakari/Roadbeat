import { describe, expect, it } from 'vitest'
import type { TripUpdates } from '../api/transitTypes'
import { mergeTripParts, regionRead } from './tripFeed'

const part = (at: TripUpdates['at']): TripUpdates => ({ at, trips: [] })

describe('mergeTripParts', () => {
  it('has nothing to show before any region has been read', () => {
    expect(mergeTripParts([])).toBeNull()
  })

  it("joins each region's snapshot", () => {
    expect(mergeTripParts([part({ SEQ: 1 }), part({ CNS: 2 })])).toEqual({ at: { SEQ: 1, CNS: 2 }, trips: [] })
  })
})

describe('regionRead', () => {
  it("knows a region only once its own feed has arrived", () => {
    const u = part({ SEQ: 1 })
    expect(regionRead(u, 'SEQ')).toBe(true)
    expect(regionRead(u, 'CNS')).toBe(false)
    expect(regionRead(null, 'SEQ')).toBe(false)
  })
})
