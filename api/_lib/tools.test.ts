import { describe, expect, it } from 'vitest'
import { TripIndex } from '../../src/api/stops'
import type { LiveVehicle, TripUpdate } from '../../src/api/transitTypes'
import type { TrafficEvent } from '../../src/api/types'
import { stopIndex } from '../../src/test/fixtures'
import { brisbaneIso, findStops, nextDepartures, resolveStop, searchRoadEvents } from './tools'

const NOW = Date.parse('2026-10-15T08:00:00+10:00')

describe('brisbaneIso', () => {
  it('writes Brisbane time with its fixed +10:00 offset', () => {
    expect(brisbaneIso(NOW)).toBe('2026-10-15T08:00:00+10:00')
    expect(brisbaneIso(null)).toBeNull()
  })
})

function event(id: number, road: string, locality: string, opts: { closure?: boolean; priority?: 'High' | 'Low' } = {}): TrafficEvent {
  return {
    type: 'Feature',
    geometry: null,
    properties: {
      id,
      status: 'Published',
      published: null,
      source: null,
      url: '',
      event_type: 'Crash',
      event_subtype: null,
      event_due_to: null,
      impact: { direction: null, towards: null, impact_type: opts.closure ? 'Closures' : 'Lanes', impact_subtype: null, delay: null },
      duration: null,
      event_priority: opts.priority ?? 'High',
      description: null,
      advice: null,
      information: null,
      road_summary: { road_name: road, locality, postcode: null, local_government_area: null, district: 'North Coast' },
      last_updated: null,
      next_inspection: null,
      web_link: null,
    },
  }
}

describe('searchRoadEvents', () => {
  const events = [event(1, 'Bruce Highway', 'Gympie', { priority: 'Low' }), event(2, 'Bruce Highway', 'Gympie', { closure: true }), event(3, 'Pacific Motorway', 'Coomera')]

  it('needs every search word to match, and ranks by priority', () => {
    const r = searchRoadEvents(events, { query: 'bruce gympie' }, NOW)
    expect(r.events.map((e) => e.id)).toEqual([2, 1])
    expect(r.events[0].road_closed).toBe(true)
  })

  it('can list closures only', () => {
    expect(searchRoadEvents(events, { closuresOnly: true }, NOW).events.map((e) => e.id)).toEqual([2])
  })
})

describe('findStops and resolveStop', () => {
  const index = stopIndex()

  it('lists stations before stops, and hides platforms', () => {
    expect(findStops(index, 'station', 'SEQ').map((s) => [s.id, s.kind])).toEqual([
      ['place_a', 'station'],
      ['place_b', 'station'],
      ['c1', 'stop'],
    ])
  })

  it('resolves an exact id or the best name match', () => {
    expect(resolveStop(index, 'a1', 'SEQ')?.id).toBe('a1')
    expect(resolveStop(index, 'bravo', undefined)?.id).toBe('place_b')
    expect(resolveStop(index, 'nowhere', undefined)).toBeNull()
  })
})

describe('nextDepartures', () => {
  const index = stopIndex()
  const trip = (id: string, delay: number, relationship: TripUpdate['relationship'] = 'scheduled'): TripUpdate => ({
    key: `SEQ-${id}`,
    region: 'SEQ',
    tripId: id,
    route: 'BRCA',
    routeId: 'BRCA',
    relationship,
    stops: [{ stopId: 'a2', sequence: 1, time: NOW + 5 * 60_000, arrivalOnly: false, delay, skipped: false }],
  })
  const info = () => ({ short: 'BRCA', long: 'Brisbane City - Caboolture', line: 'T1 Caboolture' })

  it('reports a delay only for trips with a tracked vehicle, and names the line', () => {
    const rt = { updates: { at: { SEQ: NOW }, trips: [trip('x', 120), trip('y', 120)] }, vehicles: [{ region: 'SEQ', tripId: 'x' } as LiveVehicle] }
    const r = nextDepartures(index.get('SEQ', 'place_a')!, index, new TripIndex({ trips: {} }), rt, info, { now: NOW })
    expect(r.departures.map((d) => [d.route, d.platform, d.status, d.delay_minutes, d.minutes_away])).toEqual([
      ['T1', '2', 'tracked', 2, 5],
      ['T1', '2', 'scheduled', null, 5],
    ])
  })
})
