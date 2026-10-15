import { describe, expect, it } from 'vitest'
import type { Gauge } from '../api/bccGauges'
import type { TrafficEvent } from '../api/types'
import { eventCard, gaugeCard, mapCardFor, placeCard } from './mapCard'

const NOW = Date.parse('2026-10-15T08:00:00+10:00')

const event: TrafficEvent = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [153.02, -27.47] },
  properties: {
    id: 42,
    status: 'Published',
    published: null,
    source: null,
    url: '',
    event_type: 'Crash',
    event_subtype: 'Multi-vehicle',
    event_due_to: null,
    impact: { direction: null, towards: null, impact_type: 'Closures', impact_subtype: 'Road closed to all traffic', delay: null },
    duration: null,
    event_priority: 'High',
    description: null,
    advice: null,
    information: null,
    road_summary: { road_name: 'Bruce Highway', locality: 'Gympie', postcode: null, local_government_area: null, district: 'Wide Bay/Burnett' },
    last_updated: null,
    next_inspection: null,
    web_link: null,
  },
}

describe('eventCard', () => {
  it('summarises the event with its published type, impact and priority', () => {
    expect(eventCard(event)).toMatchObject({
      key: 'event-42',
      title: 'Bruce Highway',
      subtitle: 'Gympie · Wide Bay/Burnett',
      facts: ['Crash · Multi-vehicle', 'Road closed to all traffic · High priority'],
      position: [153.02, -27.47],
    })
  })
})

describe('gaugeCard', () => {
  it('shows the latest reading with its time', () => {
    const gauge: Gauge = { id: 'E1', name: 'Oxley Ck', kind: 'stream', unit: 'm', position: [153, -27.5], readings: [{ time: NOW - 600_000, value: 1.234 }] }
    expect(gaugeCard(gauge, NOW).facts[0]).toBe('1.23 m AHD at 7:50 am')
  })
})

describe('placeCard and mapCardFor', () => {
  it('names a toilet and says whether it is accessible', () => {
    const card = placeCard({
      kind: 'toilet',
      data: { id: '1', name: 'Queens Plaza', address: null, position: [153.03, -27.47], hours: null, accessible: true, ambulant: false, adultChange: false, changingPlaces: false, mlak: false, keyRequired: false, babyChange: false, accessibleParking: false, drinkingWater: false, shower: false, notes: [], url: null },
    })
    expect(card).toMatchObject({ title: 'Queens Plaza', subtitle: 'Public toilet', facts: ['Accessible toilet'] })
  })

  it("shows an event with its image, the council's date text and its venue", () => {
    const card = placeCard({
      kind: 'event',
      data: {
        id: '182353296',
        title: 'Precious',
        description: null,
        venue: 'Museum of Brisbane',
        address: null,
        venueType: null,
        start: 0,
        end: null,
        when: 'Ongoing through Thursday, 1 April 2027',
        url: null,
        types: [],
        primaryType: null,
        cost: null,
        age: null,
        ageRange: [],
        bookings: null,
        bookingsRequired: null,
        meetingPoint: null,
        requirements: null,
        image: 'https://www.trumba.com/i/x.jpg',
        status: null,
        position: [153.0241, -27.4691],
      },
    })
    expect(card).toMatchObject({
      key: 'place-event-182353296',
      title: 'Precious',
      subtitle: 'Council event',
      facts: ['Ongoing through Thursday, 1 April 2027', 'Museum of Brisbane'],
      image: 'https://www.trumba.com/i/x.jpg',
      position: [153.0241, -27.4691],
    })
  })

  it('picks the selected item, and nothing when nothing is selected', () => {
    const none = { event: null, place: null, fire: null, gauge: null, signal: null, signalVolumes: null, vehicle: null }
    expect(mapCardFor(none, NOW)).toBeNull()
    expect(mapCardFor({ ...none, event }, NOW)?.key).toBe('event-42')
  })
})
