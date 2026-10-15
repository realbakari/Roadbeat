import { describe, expect, it } from 'vitest'
import type { Clearway, Toilet } from '../api/bccPlaces'
import { findPlace, placeFocus, type PlaceSources } from './places'

const clearway: Clearway = {
  id: '505',
  times: '7AM-9AM MON-FRI',
  geometry: { type: 'MultiLineString', coordinates: [[[153.02, -27.47], [153.03, -27.48]]] },
}
const toilet: Toilet = {
  id: 't1',
  name: 'King George Square',
  address: null,
  position: [153.024, -27.468],
  hours: null,
  accessible: true,
  ambulant: false,
  adultChange: false,
  changingPlaces: false,
  mlak: false,
  keyRequired: false,
  babyChange: false,
  accessibleParking: false,
  drinkingWater: false,
  shower: false,
  notes: [],
  url: null,
}

const sources: PlaceSources = {
  restAreas: [],
  dumpPoints: [],
  truckRestrictions: [],
  waze: [],
  clearances: null,
  clearways: [clearway],
  toilets: [toilet],
  bays: null,
  meters: null,
  bikeStops: null,
}

describe('findPlace', () => {
  it('finds a loaded place by kind and id', () => {
    expect(findPlace({ kind: 'clearway', id: '505' }, sources)).toEqual({ kind: 'clearway', data: clearway })
  })

  it('returns null for an unknown id, a list not loaded yet, or an unknown kind', () => {
    expect(findPlace({ kind: 'clearway', id: '999' }, sources)).toBeNull()
    expect(findPlace({ kind: 'bay', id: '1' }, sources)).toBeNull()
    expect(findPlace({ kind: 'castle', id: '505' }, sources)).toBeNull()
  })
})

describe('placeFocus', () => {
  it('flies to the start of a clearway', () => {
    expect(placeFocus({ kind: 'clearway', data: clearway })).toEqual({ center: [153.02, -27.47], zoom: 15 })
  })

  it('flies to a point place at its position', () => {
    expect(placeFocus({ kind: 'toilet', data: toilet })).toEqual({ center: [153.024, -27.468], zoom: 15 })
  })
})
