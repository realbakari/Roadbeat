import { describe, expect, it } from 'vitest'
import { TripIndex } from '../api/stops'
import type { LiveVehicle, StopTime, TripUpdate } from '../api/transitTypes'
import { stopIndex } from '../test/fixtures'
import { departuresAt, lineDirections, stopHref, type DepartureContext } from './departures'

const NOW = Date.parse('2026-10-17T08:00:00+10:00')
const min = (m: number) => NOW + m * 60_000

// Trip 1 runs to Caboolture (direction 0), trip 2 to Roma Street (direction 1).
const trips = new TripIndex({ trips: { SEQ: { headsigns: ['Caboolture', 'Roma Street'], ids: '1,1', info: '0,3' } } })

const stop = (stopId: string, at: number | null, over: Partial<StopTime> = {}): StopTime => ({ stopId, sequence: null, time: at, arrivalOnly: false, delay: null, skipped: false, ...over })
const trip = (tripId: string, stops: StopTime[], over: Partial<TripUpdate> = {}): TripUpdate => ({ key: `SEQ-${tripId}`, region: 'SEQ', tripId, route: 'T1', routeId: 'T1-1', relationship: 'scheduled', stops, ...over })
const ctx = (list: TripUpdate[], vehicles: LiveVehicle[] = []): DepartureContext => ({ updates: { at: {}, trips: list }, vehicles, trips, now: NOW })

describe('departuresAt', () => {
  it('lists reported departures soonest first, with the timetabled time from the reported delay', () => {
    const list = departuresAt(ctx([trip('2', [stop('a1', min(10))]), trip('1', [stop('a1', min(5), { delay: 120 })])]), 'SEQ', new Set(['a1']))
    expect(list.map((d) => [d.trip.tripId, d.headsign, d.direction])).toEqual([
      ['1', 'Caboolture', 0],
      ['2', 'Roma Street', 1],
    ])
    expect(list[0].scheduled).toBe(min(3))
    expect(list[1].scheduled).toBeNull()
  })

  it('leaves out skipped stops, arrivals only, times long gone and other regions', () => {
    const list = departuresAt(
      ctx([
        trip('1', [stop('a1', min(5), { skipped: true }), stop('a2', min(6), { arrivalOnly: true }), stop('b1', min(-2)), stop('b2', min(-0.5))]),
        trip('2', [stop('a1', min(5))], { region: 'CNS', key: 'CNS-2' }),
      ]),
      'SEQ',
      new Set(['a1', 'a2', 'b1', 'b2']),
    )
    expect(list.map((d) => d.stopId)).toEqual(['b2'])
  })

  it('marks a departure live when a vehicle reports running that trip', () => {
    const vehicle = { id: 'SEQ-v1', region: 'SEQ', tripId: '1' } as LiveVehicle
    const [d] = departuresAt(ctx([trip('1', [stop('a1', min(5))])], [vehicle]), 'SEQ', new Set(['a1']))
    expect(d.vehicle).toBe(vehicle)
  })
})

describe('lineDirections', () => {
  it('groups trips by direction and lays out stops by station in feed order', () => {
    const dirs = lineDirections(
      ctx([trip('1', [stop('a1', min(1)), stop('b1', min(5)), stop('c1', min(9), { arrivalOnly: true })]), trip('2', [stop('b2', min(2)), stop('a2', min(6))]), trip('3', [stop('a1', min(3))], { relationship: 'cancelled' })]),
      stopIndex(),
      (code) => code === 'T1',
    )
    expect(dirs.map((d) => [d.direction, d.headsigns, d.stops.map((s) => s.id)])).toEqual([
      [0, ['Caboolture'], ['place_a', 'place_b']],
      [1, ['Roma Street'], ['place_b', 'place_a']],
    ])
    expect(dirs[0].stops[0].name).toBe('Alpha station')
  })
})

describe('stopHref', () => {
  it('encodes the stop id', () => {
    expect(stopHref('SEQ', 'place_a/1')).toBe('transit/stop/SEQ/place_a%2F1')
  })
})
