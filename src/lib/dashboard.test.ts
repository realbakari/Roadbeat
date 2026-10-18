import type { AirStation } from '../api/airQuality'
import { describe, expect, it } from 'vitest'
import type { Gauge } from '../api/bccGauges'
import type { LiveVehicle, TripUpdate } from '../api/transitTypes'
import type { TrafficEvent } from '../api/types'
import { busiestSignals, closuresAndCrashesByDistrict, corridorReport, fastestRising, footTraffic, latestEvents, punctuality, upcomingEvents, worstStations } from './dashboard'

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
    source: 'bcc',
    unit: 'm',
    position: [153, -27.5],
    readings: values.map((value, i) => ({ time: NOW - (values.length - 1 - i) * 5 * 60_000, value })),
  })

  it('ranks rising gauges by their rise between real readings and leaves out falling ones', () => {
    const list = fastestRising([gauge('slow', [1, 1.1]), gauge('fast', [1, 1.5]), gauge('falling', [2, 1])], 60 * 60_000, 5, NOW)
    expect(list.map((r) => [r.gauge.id, Math.round(r.delta * 10) / 10])).toEqual([
      ['fast', 0.5],
      ['slow', 0.1],
    ])
  })

  it("leaves out a gauge whose rise was before it stopped reporting", () => {
    const quiet = { ...gauge('quiet', [1.45, 1.85]), readings: gauge('quiet', [1.45, 1.85]).readings.map((r) => ({ ...r, time: r.time - 18 * 3_600_000 })) }
    expect(fastestRising([quiet, gauge('now', [1, 1.2])], 60 * 60_000, 5, NOW).map((r) => r.gauge.id)).toEqual(['now'])
  })

  it('measures only the part of a rise within the hour before now', () => {
    const g = { ...gauge('g', [1]), readings: [{ time: NOW - 90 * 60_000, value: 1 }, { time: NOW - 50 * 60_000, value: 1.3 }, { time: NOW - 10 * 60_000, value: 1.4 }] }
    expect(fastestRising([g], 60 * 60_000, 5, NOW)[0].delta).toBeCloseTo(0.1)
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

describe('corridorReport', () => {
  it('reports the latest month with the change from a year earlier, longest AM trip first', () => {
    const corridors = [
      { siteId: 1, name: 'Coronation Drive', km: 3.5 },
      { siteId: 2, name: 'Logan Road', km: 6 },
    ]
    const m = (siteId: number, year: number, month: number, am: number) => ({ siteId, year, month, amSeconds: am, pmSeconds: am - 60, amKmh: 30 })
    const r = corridorReport(corridors, [m(1, 2026, 8, 540), m(1, 2025, 8, 500), m(2, 2026, 8, 900), m(1, 2026, 7, 999)])
    expect(r).toMatchObject({ year: 2026, month: 8 })
    expect(r!.rows.map((x) => [x.name, x.am, x.amChange])).toEqual([
      ['Logan Road', 900, null],
      ['Coronation Drive', 540, 40],
    ])
  })
})

describe('upcomingEvents', () => {
  it('lists timed events still to come today and leaves out all-day listings', () => {
    const t = (hhmm: string) => Date.parse(`2026-10-15T${hhmm}:00+10:00`)
    const events = [
      { id: 'exhibition', start: t('00:00'), end: t('23:59') },
      { id: 'short exhibition', start: t('00:00'), end: t('17:00') },
      { id: 'concert', start: t('19:30'), end: t('22:00') },
      { id: 'started', start: t('17:30'), end: null },
      { id: 'morning', start: t('09:00'), end: t('10:00') },
    ]
    expect(upcomingEvents(events, t('18:00'), 5).map((e) => e.id)).toEqual(['started', 'concert'])
  })
})

describe('footTraffic', () => {
  it('sums measured hours per precinct and leaves out estimated and "< 25" hours', () => {
    const rows = footTraffic([
      { precinct: 'Queen St Mall', sensor: 'a', count: 1000, estimated: false },
      { precinct: 'Queen St Mall', sensor: 'a', count: 900, estimated: true },
      { precinct: 'Queen St Mall', sensor: 'b', count: null, estimated: false },
      { precinct: 'Chinatown Mall', sensor: 'c', count: 300, estimated: false },
    ])
    expect(rows).toEqual([
      { precinct: 'Queen St Mall', movements: 1000, measuredHours: 1, hours: 3 },
      { precinct: 'Chinatown Mall', movements: 300, measuredHours: 1, hours: 1 },
    ])
  })
})

describe('worstStations', () => {
  const station = (id: string, ratings: (1 | 2 | 3 | 4 | 5 | null)[]): AirStation => ({
    id,
    name: id,
    region: 'SEQ',
    link: '',
    position: [0, 0],
    measuredAt: 0,
    measurements: ratings.map((r, i) => ({ name: `m${i}`, units: null, averaging: null, value: r ? 1 : null, gap: r ? null : 'offline', index: null, rating: r, ratingName: null })),
  })

  it('lists stations rated Fair or worse, worst first, by their worst reading', () => {
    const list = worstStations([station('b', [1, 3]), station('a', [5, 2]), station('c', [2, null]), station('d', [4])])
    expect(list.map((w) => [w.station.id, w.rating])).toEqual([['a', 5], ['d', 4], ['b', 3]])
  })
})
