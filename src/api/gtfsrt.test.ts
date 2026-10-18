import { describe, expect, it } from 'vitest'
import { decodeFeed, parseTripUpdates, parseVehicles, routeCode, rt, type RouteLookup } from './gtfsrt'

// Feeds are built with the GTFS-RT bindings and round-tripped through protobuf,
// so the parsers see what TransLink's feed decodes to.
const feed = (entity: object[], timestamp = 1_792_000_000) =>
  decodeFeed(rt.FeedMessage.encode(rt.FeedMessage.fromObject({ header: { gtfsRealtimeVersion: '2.0', timestamp }, entity })).finish())

const routes: RouteLookup = (code) => (code === 'BRCA' ? { mode: 'train', line: 'T1 Caboolture', long: 'Brisbane City - Caboolture', color: '#00467F' } : null)

describe('routeCode', () => {
  it('drops the timetable suffix from a route id', () => {
    expect(routeCode('402-4596')).toBe('402')
    expect(routeCode('BRCA')).toBe('BRCA')
  })
})

describe('parseVehicles', () => {
  it('reads a position with its route, trip and status as reported', () => {
    const [v] = parseVehicles(
      'SEQ',
      feed([{ id: 'e1', vehicle: { trip: { tripId: '123-x', routeId: 'BRCA' }, vehicle: { id: 'v9', label: 'IMU 123' }, position: { latitude: -27.5, longitude: 153.25, bearing: 90 }, currentStatus: 1, stopId: '600029', timestamp: 1_792_000_000 } }]),
      routes,
    )
    expect(v).toEqual({
      id: 'SEQ-v9',
      region: 'SEQ',
      mode: 'train',
      route: 'BRCA',
      routeId: 'BRCA',
      tripId: '123-x',
      lineName: 'T1 Caboolture',
      routeName: 'Brisbane City - Caboolture',
      color: '#00467F',
      label: 'IMU 123',
      position: [153.25, -27.5],
      bearing: 90,
      status: 'stopped',
      stopId: '600029',
      timestamp: 1_792_000_000_000,
    })
  })

  it('skips vehicles with no position, calls an unknown route a bus, and claims no status the feed left out', () => {
    const list = parseVehicles('SEQ', feed([{ id: 'e1', vehicle: { trip: { routeId: '402-4596' } } }, { id: 'e2', vehicle: { trip: { routeId: '402-4596' }, position: { latitude: -27.5, longitude: 153 } } }]), routes)
    expect(list.map((v) => [v.id, v.mode, v.route, v.tripId, v.status])).toEqual([['SEQ-e2', 'bus', '402', null, null]])
  })
})

describe('parseTripUpdates', () => {
  it('reads stop times, delays, skipped stops and cancellations as reported', () => {
    const u = parseTripUpdates(
      'SEQ',
      feed([
        {
          id: 't1',
          tripUpdate: {
            trip: { tripId: '123-x', routeId: '402-4596' },
            stopTimeUpdate: [
              { stopId: 'a', stopSequence: 1, departure: { time: 1_792_000_060, delay: 60 } },
              { stopId: 'b', stopSequence: 2, scheduleRelationship: 1 },
              { stopId: 'c', stopSequence: 3, arrival: { time: 1_792_000_300, delay: -30 } },
              { stopSequence: 4, arrival: { time: 1_792_000_400 } },
              { stopId: 'd', departure: { time: 1_792_000_500 } },
            ],
          },
        },
        { id: 't2', tripUpdate: { trip: { tripId: '456-y', routeId: 'BRCA', scheduleRelationship: 3 } } },
        { id: 't3', tripUpdate: { trip: { routeId: 'BRCA' } } },
      ]),
    )
    expect(u.at).toEqual({ SEQ: 1_792_000_000_000 })
    expect(u.trips.map((t) => [t.key, t.route, t.relationship])).toEqual([
      ['SEQ-123-x', '402', 'scheduled'],
      ['SEQ-456-y', 'BRCA', 'cancelled'],
    ])
    expect(u.trips[0].stops).toEqual([
      { stopId: 'a', sequence: 1, time: 1_792_000_060_000, arrivalOnly: false, delay: 60, skipped: false },
      { stopId: 'b', sequence: 2, time: null, arrivalOnly: true, delay: null, skipped: true },
      { stopId: 'c', sequence: 3, time: 1_792_000_300_000, arrivalOnly: true, delay: -30, skipped: false },
      // No sequence or delay sent: neither is read as 0 ("on time").
      { stopId: 'd', sequence: null, time: 1_792_000_500_000, arrivalOnly: false, delay: null, skipped: false },
    ])
  })
})
