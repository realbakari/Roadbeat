import { describe, expect, it } from 'vitest'
import type { Gauge } from '../api/bccGauges'
import type { LiveVehicle, TripUpdate } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { busiestSignals, closuresAndCrashesByDistrict, fastestRising, latestEvents, punctuality } from './dashboard'

const NOW = Date.parse('2026-10-15T08:00:00+10:00')

function event(id: number, type: TrafficEvent['properties']['event_type'], district: string, opts: { closure?: boolean; updated?: string } = {}): TrafficEvent {
  return {
    type: 'Feature',
    geometry: null,
    properties: {
      id,
      status: 'Published',
      published: null,
      source: null,
      url: '',
      event_type: type,
      event_subtype: null,
      event_due_to: null,
      impact: opts.closure ? { direction: null, towards: null, impact_type: 'Closures', impact_subtype: null, delay: null } : null,
      duration: null,
      event_priority: 'High',
      description: null,
      advice: null,
      information: null,
      road_summary: { road_name: `Road ${id}`, locality: null, postcode: null, local_government_area: null, district },
      last_updated: opts.updated ?? null,
      next_inspection: null,
      web_link: null,
    },
  }
}

describe('closuresAndCrashesByDistrict', () => {
  it('counts closures and crashes per district, busiest first', () => {
    const rows = closuresAndCrashesByDistrict(
      [
        event(1, 'Crash', 'Metropolitan'),
        event(2, 'Hazard', 'Metropolitan', { closure: true }),
        event(3, 'Crash', 'Metropolitan', { closure: true }),
        event(4, 'Crash', 'South Coast'),
        event(5, 'Congestion', 'Wide Bay'),
      ],
      NOW,
    )
    expect(rows).toEqual([
      { district: 'Metropolitan', closures: 2, crashes: 2 },
      { district: 'South Coast', closures: 0, crashes: 1 },
    ])
  })
})

describe('latestEvents', () => {
  it('lists the most recently updated first', () => {
    const list = latestEvents([event(1, 'Crash', 'A', { updated: '2026-10-15T07:00:00+10:00' }), event(2, 'Crash', 'A', { updated: '2026-10-15T07:30:00+10:00' })], NOW, 5)
    expect(list.map((e) => e.properties.id)).toEqual([2, 1])
  })
})

describe('punctuality', () => {
  const trip = (id: string, delay: number | null, relationship: TripUpdate['relationship'] = 'scheduled'): TripUpdate => ({
    key: `SEQ-${id}`,
    region: 'SEQ',
    tripId: id,
    route: 'BRCA',
    routeId: 'BRCA',
    relationship,
    stops: [
      { stopId: 'passed', sequence: 1, time: NOW - 10 * 60_000, arrivalOnly: false, delay: 900, skipped: false },
      { stopId: 'next', sequence: 2, time: NOW + 60_000, arrivalOnly: false, delay, skipped: false },
    ],
  })
  const vehicle = (tripId: string) => ({ region: 'SEQ', tripId }) as LiveVehicle

  it('classifies tracked trips by the delay at their next stop and counts cancellations', () => {
    const updates = { at: {}, trips: [trip('a', 0), trip('b', 400), trip('c', -120), trip('d', 299), trip('e', 600), trip('f', null, 'cancelled')] }
    const [train] = punctuality(updates, ['a', 'b', 'c', 'd'].map(vehicle), NOW, () => 'train')
    // Trip e has no vehicle, so its delay is only the timetable and it isn't counted.
    expect(train).toEqual({ mode: 'train', tracked: 4, onTime: 2, late: 1, early: 1, cancelled: 1 })
  })
})

describe('fastestRising', () => {
  const gauge = (id: string, values: number[]): Gauge => ({
    id,
    name: id,
    kind: 'stream',
    unit: 'm',
    position: [153, -27.5],
    readings: values.map((value, i) => ({ time: NOW - (values.length - 1 - i) * 5 * 60_000, value })),
  })

  it('ranks rising gauges by their rise between real readings and leaves out falling ones', () => {
    const list = fastestRising([gauge('slow', [1, 1.1]), gauge('fast', [1, 1.5]), gauge('falling', [2, 1])], 60 * 60_000, 5)
    expect(list.map((r) => [r.gauge.id, Math.round(r.delta * 10) / 10])).toEqual([
      ['fast', 0.5],
      ['slow', 0.1],
    ])
  })
})

describe('busiestSignals', () => {
  it('ranks sites by their most saturated lane', () => {
    const site = (tsc: string) => ({ tsc, suburb: 'X', position: [153, -27.5] as [number, number], streets: [] })
    const volumes = new Map([
      ['1', [{ id: 'SA-1', recorded: NOW, cycle: 120, lanes: [{ ds: 60, vehicles: 10 }] }]],
      ['2', [{ id: 'SA-2', recorded: NOW, cycle: 120, lanes: [{ ds: 95, vehicles: 8 }, { ds: 20, vehicles: 2 }] }]],
    ])
    expect(busiestSignals([site('1'), site('2'), site('3')], volumes, 5).map((s) => [s.site.tsc, s.maxDs])).toEqual([
      ['2', 95],
      ['1', 60],
    ])
  })
})
