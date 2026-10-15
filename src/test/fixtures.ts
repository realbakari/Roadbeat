import { StopIndex } from '../api/stops'
import type { ScheduledStop, ScheduledTrip, StopKind } from '../api/timetables'

/** A small network: two stations with platforms, plus one bus stop. */
export function stopIndex() {
  return new StopIndex().add({
    stops: {
      SEQ: [
        ['place_a', 'Alpha station', -27.4, 153.0, 0, 0],
        ['a1', 'Alpha station, platform 1', -27.4, 153.0, 'place_a', '1'],
        ['a2', 'Alpha station, platform 2', -27.4, 153.0, 'place_a', '2'],
        ['place_b', 'Bravo station', -27.5, 153.0, 0, 0],
        ['b1', 'Bravo station, platform 1', -27.5, 153.0, 'place_b', '1'],
        ['b2', 'Bravo station, platform 2', -27.5, 153.0, 'place_b', '2'],
        ['c1', 'Charlie station', -27.6, 153.0, 0, 0],
        ['d1', 'Delta stop', -27.7, 153.0, 0, 0],
      ],
    },
  })
}

const T0 = Date.parse('2026-10-15T00:00:00+10:00')
/** Minutes after midnight on 15 Oct 2026 in Brisbane, as a timestamp. */
export const at = (minutes: number) => T0 + minutes * 60_000

/** A trip from [stop id, departure minute, arrival minute?, kind?] tuples. */
export function trip(number: number, route: string, stops: [string, number, number?, StopKind?][]): ScheduledTrip {
  return {
    key: `SEQ-${number}-2026-10-15`,
    region: 'SEQ',
    route,
    number,
    headsign: 'Somewhere',
    direction: 0,
    stops: stops.map(
      ([stopId, dep, arr, kind]): ScheduledStop => ({ stopId, time: at(dep), arrival: at(arr ?? dep), kind: kind ?? 'normal' }),
    ),
  }
}
