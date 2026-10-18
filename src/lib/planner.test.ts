import { describe, expect, it } from 'vitest'
import { at, stopIndex, trip } from '../test/fixtures'
import { changeTime, legMode, planJourneys, searchStops, shortName, stopAndChildren } from './planner'

const stops = stopIndex()
const ids = (id: string) => stopAndChildren(stops, stops.get('SEQ', id)!)

describe('planJourneys', () => {
  it('finds a direct service between two stations on any platform', () => {
    const trips = [trip(1, 'R1', [['a1', 480], ['b2', 490], ['c1', 500]])]
    const [j] = planJourneys(trips, stops, ids('place_a'), ids('place_b'))
    expect(j.legs).toHaveLength(1)
    expect([j.dep, j.arr]).toEqual([at(480), at(490)])
  })

  it('changes at the same station when no direct service runs, timing the change from the published arrival', () => {
    const trips = [
      trip(1, 'R1', [['a1', 480], ['b1', 495, 494]]),
      trip(2, 'R2', [['b2', 500], ['d1', 520]]),
    ]
    const [j] = planJourneys(trips, stops, ids('place_a'), ids('d1'))
    expect(j.legs.map((l) => l.trip.route)).toEqual(['R1', 'R2'])
    expect(changeTime(j)).toBe(6 * 60_000)
    expect(j.arr).toBe(at(520))
  })

  it('needs at least a minute to change', () => {
    const trips = [
      trip(1, 'R1', [['a1', 480], ['b1', 500]]),
      trip(2, 'R2', [['b2', 500], ['d1', 520]]),
    ]
    expect(planJourneys(trips, stops, ids('place_a'), ids('d1'))).toEqual([])
  })

  it('never changes at a different stop, because that would need a walking time', () => {
    const trips = [
      trip(1, 'R1', [['a1', 480], ['c1', 490]]),
      trip(2, 'R2', [['b1', 500], ['d1', 520]]),
    ]
    expect(planJourneys(trips, stops, ids('place_a'), ids('d1'))).toEqual([])
  })

  it('drops options that leave earlier but arrive no sooner', () => {
    const trips = [
      trip(1, 'SLOW', [['a1', 480], ['b1', 530]]),
      trip(2, 'FAST', [['a2', 490], ['b2', 510]]),
    ]
    expect(planJourneys(trips, stops, ids('place_a'), ids('place_b')).map((j) => j.legs[0].trip.route)).toEqual(['FAST'])
  })

  it('does not board where the trip only sets down', () => {
    const trips = [trip(1, 'R1', [['c1', 470], ['a1', 480, 480, 'arrival'], ['b1', 490]])]
    expect(planJourneys(trips, stops, ids('place_a'), ids('place_b'))).toEqual([])
  })
})

describe('searchStops', () => {
  it('lists stations, not their platforms, best match first', () => {
    expect(searchStops(stops, 'bravo').map((s) => s.id)).toEqual(['place_b'])
    expect(searchStops(stops, 'station').map((s) => s.id)).toContain('place_a')
  })
  it('needs at least two characters', () => {
    expect(searchStops(stops, 'a')).toEqual([])
  })
})

describe('shortName', () => {
  it('drops a trailing "station" in any case', () => {
    expect(shortName('Central station')).toBe('Central')
    expect(shortName('Roma Street Station')).toBe('Roma Street')
  })

  it('leaves other names alone', () => {
    expect(shortName('Station Road')).toBe('Station Road')
    expect(shortName('Cultural Centre, platform 1')).toBe('Cultural Centre, platform 1')
  })
})

describe('legMode', () => {
  const leg = (route: string) => planJourneys([trip(1, route, [['a1', 480], ['b2', 490]])], stops, ids('place_a'), ids('place_b'))[0].legs[0]

  it('reads the mode from the published route', () => {
    expect(legMode(leg('BDBN'))).toBe('train')
  })

  it('falls back to bus for a route the data does not list', () => {
    expect(legMode(leg('NOT-A-ROUTE'))).toBe('bus')
  })
})
