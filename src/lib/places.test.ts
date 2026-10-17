import { describe, expect, it } from 'vitest'
import type { CouncilEvent } from '../api/bccDashboard'
import type { Clearway, Toilet } from '../api/bccPlaces'
import { parseQldWarnings } from '../api/qldWarnings'
import SAMPLES from '../test/qldWarnings.json'
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
const event: CouncilEvent = {
  id: '182353296',
  title: 'Precious',
  description: null,
  venue: 'Museum of Brisbane',
  address: null,
  venueType: null,
  start: Date.parse('2025-04-06T14:00:00Z'),
  end: null,
  when: 'Ongoing through Thursday, 1 April 2027',
  url: null,
  types: ['Art'],
  primaryType: null,
  cost: 'Free',
  age: null,
  ageRange: [],
  bookings: null,
  bookingsRequired: null,
  meetingPoint: null,
  requirements: null,
  image: 'https://www.trumba.com/i/x.jpg',
  status: null,
  position: [153.0241, -27.4691],
}

const sources: PlaceSources = {
  hotspots: null,
  nswFires: null,
  cyclones: null,
  pastCyclones: null,
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
  councilEvents: [event],
  councilCentres: null,
  outages: null,
  airStations: null,
  warnings: parseQldWarnings(SAMPLES.live),
}

describe('findPlace', () => {
  it('finds a loaded place by kind and id', () => {
    expect(findPlace({ kind: 'clearway', id: '505' }, sources)).toEqual({ kind: 'clearway', data: clearway })
    expect(findPlace({ kind: 'event', id: '182353296' }, sources)).toEqual({ kind: 'event', data: event })
    expect(findPlace({ kind: 'warning', id: 'HN_15102026' }, sources)?.data).toMatchObject({ area: 'Isisford' })
  })

  it('flies to an event at its published position, and nowhere when it has none', () => {
    expect(placeFocus({ kind: 'event', data: event })).toEqual({ center: [153.0241, -27.4691], zoom: 15 })
    expect(placeFocus({ kind: 'event', data: { ...event, position: null } })).toBeNull()
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
