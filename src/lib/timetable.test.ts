import { describe, expect, it } from 'vitest'
import { at, trip } from '../test/fixtures'
import { StopIndex } from '../api/stops'
import { liveLookup, scheduledArrivals, scheduledDepartures, timetableGrid } from './timetable'

const trips = [
  trip(1, 'R1', [['a1', 480], ['b1', 490], ['c1', 500]]),
  trip(2, 'R2', [['c1', 470], ['b2', 485, 484, 'arrival'], ['a2', 495]]),
]

describe('scheduledDepartures', () => {
  it('lists departures, never a trip that only sets down or ends here', () => {
    const list = scheduledDepartures(trips, new Set(['b1', 'b2']))
    expect(list.map((d) => d.trip.route)).toEqual(['R1'])
    expect(scheduledDepartures(trips, new Set(['c1'])).map((d) => d.trip.route)).toEqual(['R2'])
  })
})

describe('scheduledArrivals', () => {
  it('lists trips that end or only set down here, in arrival order', () => {
    const list = scheduledArrivals(trips, new Set(['b2', 'c1']))
    expect(list.map((d) => [d.trip.route, d.stop.stopId])).toEqual([
      ['R2', 'b2'],
      ['R1', 'c1'],
    ])
  })
})

describe('timetableGrid', () => {
  it('orders services by Roma Street when every service calls at it, as Translink does', () => {
    const stops = new StopIndex().add({
      stops: {
        SEQ: [
          ['petrie', 'Petrie station', -27.27, 152.98, 0, 0],
          ['central', 'Central station', -27.466, 153.026, 0, 0],
          ['roma', 'Roma Street station', -27.46, 153.02, 0, 0],
        ],
      },
    })
    // Trip 2 leaves Petrie and Central first but reaches Roma Street second.
    const [dir] = timetableGrid(
      [
        trip(1, 'T1', [['petrie', 600], ['central', 628], ['roma', 630]]),
        trip(2, 'T1', [['petrie', 590], ['central', 627], ['roma', 640]]),
      ],
      stops,
    )
    expect(dir.rows[dir.reference].name).toBe('Roma Street station')
    expect(dir.trips.map((t) => t.number)).toEqual([1, 2])
  })
})

describe('liveLookup', () => {
  it("tells a loop's departure from its own stop apart from the loop's return there", () => {
    const loop = trip(5, 'L1', [['a', 480], ['b', 500], ['a', 525]])
    const stop = (stopId: string, sequence: number, minute: number) => ({ stopId, sequence, time: at(minute), arrivalOnly: false, delay: null, skipped: false })
    const live = liveLookup(
      { at: { SEQ: at(470) }, trips: [{ key: 'SEQ-5-x', region: 'SEQ', tripId: '5-x', route: 'L1', routeId: 'L1-1', relationship: 'scheduled', stops: [stop('a', 1, 481), stop('b', 2, 501), stop('a', 3, 526)] }] },
      [],
    ).get(loop)
    expect(live?.stopTime(loop.stops[0])?.time).toBe(at(481))
    expect(live?.stopTime(loop.stops[2])?.time).toBe(at(526))
  })
})
