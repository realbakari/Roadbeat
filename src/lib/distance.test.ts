import { describe, expect, it } from 'vitest'
import { distanceKm } from './distance'

describe('distanceKm', () => {
  it('measures great-circle distance: a degree of latitude is about 111 km', () => {
    expect(distanceKm([153, -27], [153, -28])).toBeCloseTo(111.19, 2)
    expect(distanceKm([153.0251, -27.4698], [153.4, -28.0167])).toBeCloseTo(71.1, 1)
  })
  it('is zero for the same point and the same either way', () => {
    expect(distanceKm([153, -27], [153, -27])).toBe(0)
    expect(distanceKm([153, -27], [146, -19])).toBeCloseTo(distanceKm([146, -19], [153, -27]), 9)
  })
})
