import { describe, expect, it } from 'vitest'
import { at, trip } from '../test/fixtures'
import type { LiveVehicle, TripUpdate, TripUpdates } from '../api/transitTypes'
import { scheduledDepartures } from './timetable'
import { liveTrip, overdueMinutes, pickRun, reportingTrips, timetableTripHref, tripHref, tripStops, watchFeed } from './trip'

function update(tripId: string, stops: [string, number, number?][], relationship: TripUpdate['relationship'] = 'scheduled'): TripUpdate {
  return {
    key: `SEQ-${tripId}`,
    region: 'SEQ',
    tripId,
    route: 'R1',
    routeId: 'R1-4421',
    relationship,
    stops: stops.map(([stopId, minute, delay], i) => ({
      stopId,
      sequence: i + 1,
      time: at(minute),
      arrivalOnly: false,
      delay: delay ?? null,
      skipped: false,
    })),
  }
}

function vehicle(tripId: string, stopId: string | null): LiveVehicle {
  return {
    id: 'SEQ-v1',
    region: 'SEQ',
    mode: 'train',
    route: 'R1',
    routeId: 'R1-4421',
    tripId,
    lineName: null,
    routeName: null,
    color: null,
    label: null,
    position: [153, -27.5],
    bearing: null,
    status: 'stopped',
    stopId,
    timestamp: at(490),
  }
}

const feed = (trips: TripUpdate[], minute: number): TripUpdates => ({
  at: { SEQ: at(minute) },
  trips,
})

describe('tripHref', () => {
  it('carries the trip id, route and service day', () => {
    expect(tripHref('SEQ', '123-QR 25_26', 'BRCA', '2026-10-15')).toBe('transit/trip/SEQ/123-QR%2025_26/BRCA/2026-10-15')
    expect(tripHref('SEQ', 123, '402')).toBe('transit/trip/SEQ/123/402')
    expect(timetableTripHref(trip(7, 'R1', [['a1', 480]]))).toBe('transit/trip/SEQ/7/R1/2026-10-15')
  })
})

describe('pickRun', () => {
  const today = trip(7, 'R1', [
    ['a1', 480],
    ['b1', 490],
  ])
  const yesterday = {
    ...trip(7, 'R1', [
      ['a1', 480 - 1440],
      ['b1', 490 - 1440],
    ]),
    key: 'SEQ-7-2026-10-14',
  }
  it('picks the run on the given service day', () => {
    expect(pickRun([yesterday, today], 7, '2026-10-14', null, at(485))).toBe(yesterday)
  })
  it('otherwise picks the run the feed reports, and none if it is a different day', () => {
    expect(pickRun([yesterday, today], 7, null, update('7-x', [['b1', 492]]), at(0))).toBe(today)
    expect(pickRun([today], 7, null, update('7-x', [['b1', 492 + 1440]]), at(0))).toBeNull()
  })
  it('never gives an ADDED trip a timetabled run, though its id shares the number', () => {
    expect(pickRun([today], 7, null, update('7-QR 44306-TM27', [['b1', 492]], 'added'), at(485))).toBeNull()
  })
  it('never gives an ADDED trip a timetabled run, though its id shares the number', () => {
    expect(pickRun([today], 7, null, update('7-QR 44306-TM27', [['b1', 492]], 'added'), at(485))).toBeNull()
  })
  it('otherwise picks the run in progress', () => {
    expect(pickRun([yesterday, today], 7, null, null, at(485))).toBe(today)
  })
})

describe('liveTrip', () => {
  it('matches the feed by trip number and the vehicle by trip id', () => {
    const u = update('7-QR', [['b1', 492]])
    const v = vehicle('7-QR', 'b1')
    expect(liveTrip(feed([u], 485), [v], 'SEQ', 7, at(480))).toEqual({
      update: u,
      vehicle: v,
    })
    expect(liveTrip(feed([u], 485), [v], 'SEQ', 8, at(480))).toEqual({ update: null, vehicle: null })
  })
  it('never attaches an ADDED trip to a timetabled run, though its id shares the number', () => {
    const extra = update('7-QR 44306-TM27', [['b1', 492]], 'added')
    expect(liveTrip(feed([extra], 485), [vehicle(extra.tripId, 'b1')], 'SEQ', 7, at(480))).toEqual({ update: null, vehicle: null })
    expect(liveTrip(feed([extra], 485), [], 'SEQ', 7, null).update).toBe(extra)
  })
})

describe('tripStops', () => {
  const t = trip(7, 'R1', [
    ['a1', 480],
    ['b1', 490],
    ['c1', 500],
    ['d1', 510],
  ])
  it('gives each stop only what the feed reports for it', () => {
    const rows = tripStops(
      t,
      update('7-QR', [
        ['b1', 492, 120],
        ['c1', 502, 120],
      ]),
      null,
    )
    expect(rows.map((r) => r.rt?.delay ?? null)).toEqual([null, 120, 120, null])
    expect(rows.some((r) => r.passed || r.here)).toBe(false)
  })
  it('marks stops passed only from the stop the vehicle reports', () => {
    const rows = tripStops(t, null, vehicle('7-QR', 'c1'))
    expect(rows.map((r) => [r.passed, r.here])).toEqual([
      [true, false],
      [true, false],
      [false, true],
      [false, false],
    ])
  })
  it('matches another platform of the same station', () => {
    const same = (a: string, b: string) => a[0] === b[0]
    const rows = tripStops(t, update('7-QR', [['b2', 491]]), vehicle('7-QR', 'b2'), same)
    expect(rows[1].rt?.stopId).toBe('b2')
    expect(rows[1].here).toBe(true)
    expect([rows[1].stopId, rows[1].movedFrom]).toEqual(['b2', 'b1'])
    expect(rows[0].movedFrom).toBeNull()
  })
  it('places stops only the feed lists after the feed stop before them, and never marks an omitted stop skipped', () => {
    const rows = tripStops(
      t,
      update('7-QR', [
        ['x1', 470],
        ['b1', 492],
        ['x2', 495],
        ['c1', 502],
      ]),
      null,
    )
    expect(rows.map((r) => [r.stopId, r.added])).toEqual([
      ['x1', true],
      ['a1', false],
      ['b1', false],
      ['x2', true],
      ['c1', false],
      ['d1', false],
    ])
    expect(rows.some((r) => r.rt?.skipped)).toBe(false)
  })
  it('lists the feed’s stops for a trip the timetable lacks', () => {
    const rows = tripStops(
      null,
      update('99-X', [
        ['a1', 480],
        ['c1', 500],
      ]),
      null,
    )
    expect(rows.map((r) => [r.stopId, r.scheduled])).toEqual([
      ['a1', null],
      ['c1', null],
    ])
  })
})

describe('watchFeed', () => {
  it('keeps its start time while polls arrive without a break, and restarts after a gap', () => {
    let w = watchFeed(null, 'SEQ', feed([update('7-QR', [['b1', 492]])], 470))
    w = watchFeed(w, 'SEQ', feed([], 471))
    expect(w.since.SEQ).toBe(at(470))
    expect(w.seen.has('SEQ-7')).toBe(true)
    w = watchFeed(w, 'SEQ', feed([], 480))
    expect(w.since.SEQ).toBe(at(480))
    expect(w.seen.has('SEQ-7')).toBe(true)
  })
})

describe('overdueMinutes', () => {
  const t = trip(7, 'R1', [
    ['a1', 480],
    ['b1', 490],
    ['c1', 520],
  ])
  const dep = scheduledDepartures([t], new Set(['b1']))[0]
  /** Polls every minute from `from` to `to` (feed minutes), each listing `trips`. */
  const watched = (from: number, to: number, trips: (m: number) => TripUpdate[] = () => []) => {
    let w = null as ReturnType<typeof watchFeed> | null
    for (let m = from; m <= to; m++) w = watchFeed(w, 'SEQ', feed(trips(m), m))
    return w
  }

  it('counts minutes past due for a trip the feed never listed while watched since before it started', () => {
    expect(overdueMinutes(dep, watched(470, 500), new Set(), at(500))).toBe(10)
  })
  it('says nothing for a trip the feed listed at any point, as when it drops a trip’s last stops', () => {
    const listedEarly = watched(470, 500, (m) =>
      m < 485
        ? [
            update('7-QR', [
              ['a1', 480],
              ['b1', 490],
            ]),
          ]
        : [],
    )
    expect(overdueMinutes(dep, listedEarly, new Set(), at(500))).toBeNull()
  })
  it('says nothing for a cancelled trip, which the feed lists', () => {
    expect(
      overdueMinutes(
        dep,
        watched(470, 500, () => [update('7-QR', [['b1', 490]], 'cancelled')]),
        new Set(),
        at(500),
      ),
    ).toBeNull()
  })
  it('says nothing while a vehicle reports the trip', () => {
    expect(overdueMinutes(dep, watched(470, 500), reportingTrips([vehicle('7-QR', 'a1')]), at(500))).toBeNull()
  })
  it('says nothing unless watched without a break from before the trip started until after it was due', () => {
    expect(overdueMinutes(dep, watched(481, 500), new Set(), at(500))).toBeNull()
    expect(overdueMinutes(dep, watched(470, 489), new Set(), at(500))).toBeNull()
    expect(overdueMinutes(dep, null, new Set(), at(500))).toBeNull()
  })
  it('says nothing before it is due or long after', () => {
    expect(overdueMinutes(dep, watched(470, 490), new Set(), at(490))).toBeNull()
    expect(overdueMinutes(dep, watched(470, 530), new Set(), at(530))).toBeNull()
  })
})

describe('tripStops on a loop', () => {
  const loop = trip(9, 'L1', [['a', 480], ['b', 490], ['a', 525]])
  const last = { ...update('9-x', [['a', 526]]), stops: [{ ...update('9-x', [['a', 526]]).stops[0], sequence: 3 }] }

  it('attaches the report to the visit the feed means, and finds the vehicle there', () => {
    const rows = tripStops(loop, last, vehicle('9-x', 'a'))
    expect(rows.map((r) => [r.stopId, !!r.rt, r.here, r.passed])).toEqual([
      ['a', false, false, true],
      ['b', false, false, true],
      ['a', true, true, false],
    ])
  })
})
