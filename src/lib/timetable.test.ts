import { describe, expect, it } from 'vitest'
import { trip } from '../test/fixtures'
import { scheduledArrivals, scheduledDepartures } from './timetable'

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
