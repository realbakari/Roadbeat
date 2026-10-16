import { describe, expect, it } from 'vitest'
import { at, trip } from '../test/fixtures'
import type { StopTime } from '../api/transitTypes'
import { alignStops } from './stopAlign'

const rt = (stopId: string, sequence: number | null, minute: number): StopTime => ({ stopId, sequence, time: at(minute), arrivalOnly: false, delay: null, skipped: false })

// A loop from a, round b and c, and back to a.
const loop = trip(1, 'L1', [['a', 480], ['b', 490], ['c', 500], ['a', 525]]).stops
const ids = (out: (StopTime | null)[]) => out.map((r) => (r ? `${r.stopId}${r.sequence ?? ""}` : null))

describe('alignStops', () => {
  it("gives a loop's last stop its own report when the feed has dropped the rest", () => {
    expect(ids(alignStops(loop, [rt('a', 4, 526)]))).toEqual([null, null, null, 'a4'])
  })

  it('keeps both visits apart when the feed lists them all', () => {
    expect(ids(alignStops(loop, [rt('a', 1, 481), rt('b', 2, 491), rt('c', 3, 501), rt('a', 4, 526)]))).toEqual(['a1', 'b2', 'c3', 'a4'])
  })

  it('never puts a stop later than its sequence allows', () => {
    // The feed lists only the origin; stop sequence 1 can't be the fourth stop.
    expect(ids(alignStops(loop, [rt('a', 1, 481)]))).toEqual(['a1', null, null, null])
  })

  it('matches in trip order, so the next stop after c is the second a', () => {
    expect(ids(alignStops(loop, [rt('c', null, 501), rt('a', null, 526)]))).toEqual([null, null, 'c', 'a'])
  })

  it('prefers the exact stop over another platform of the station', () => {
    const t = trip(2, 'T1', [['p1', 480], ['q1', 490], ['p2', 500]]).stops
    const same = (x: string, y: string) => x[0] === y[0]
    expect(ids(alignStops(t, [rt('p1', null, 481)], same))).toEqual(['p1', null, null])
    expect(ids(alignStops(t, [rt('q2', null, 491)], same))).toEqual([null, 'q2', null])
  })
})
