import { describe, expect, it } from 'vitest'
import type { FireWarning } from '../api/bushfireFeed'
import type { LiveVehicle, TripUpdate } from '../api/transitTypes'
import type { TrafficEvent } from '../api/types'
import { commuteAlerts, commuteWindow, DEFAULT_COMMUTE, firesNear, roadEventsFor, roadsBriefing, type Commute } from './commute'
import type { Departure } from './departures'

// Thursday 15 October 2026, Brisbane time.
const at = (hhmm: string, day = 15) => Date.parse(`2026-10-${day}T${hhmm}:00+10:00`)
const commute: Commute = { ...DEFAULT_COMMUTE, roads: ['Ipswich Motorway'], stopId: 'place_romsta', route: 'T1', minutes: 7 * 60 + 40 }

function event(id: number, road: string, opts: { closure?: boolean; type?: TrafficEvent['properties']['event_type'] } = {}): TrafficEvent {
  return {
    type: 'Feature',
    geometry: null,
    properties: {
      id,
      status: 'Published',
      published: null,
      source: null,
      url: '',
      event_type: opts.type ?? 'Crash',
      event_subtype: null,
      event_due_to: null,
      impact: { direction: null, towards: null, impact_type: opts.closure ? 'Closures' : 'Lanes', impact_subtype: null, delay: null },
      duration: null,
      event_priority: 'High',
      description: 'Near Goodna',
      advice: null,
      information: null,
      road_summary: { road_name: road, locality: 'Goodna', postcode: null, local_government_area: null, district: 'Metropolitan' },
      last_updated: null,
      next_inspection: null,
      web_link: null,
    },
  }
}

describe('commuteWindow', () => {
  it('is active from 90 minutes before to 30 minutes after on a commute day', () => {
    expect(commuteWindow(commute, at('06:00'))).toEqual({ departs: at('07:40'), active: false })
    expect(commuteWindow(commute, at('06:15'))?.active).toBe(true)
    expect(commuteWindow(commute, at('08:05'))?.active).toBe(true)
  })

  it('moves to the next commute day once the window has passed', () => {
    // Friday 16th, then Monday 19th after Friday's window.
    expect(commuteWindow(commute, at('09:00'))?.departs).toBe(at('07:40', 16))
    expect(commuteWindow(commute, at('09:00', 16))?.departs).toBe(at('07:40', 19))
  })
})

describe('roadEventsFor', () => {
  it('matches the commute roads and puts closures first', () => {
    const list = roadEventsFor(commute, [event(1, 'Ipswich Motorway'), event(2, 'Ipswich Motorway', { closure: true }), event(3, 'Logan Motorway')], at('07:00'))
    expect(list.map((e) => e.properties.id)).toEqual([2, 1])
  })
})

describe('roadsBriefing', () => {
  it("never reads as all clear before QLDTraffic's events have loaded", () => {
    expect(roadsBriefing(commute, [], null, null, at('07:00'))).toEqual({ state: 'loading' })
    expect(roadsBriefing(commute, [], null, 'QLDTraffic responded with 502', at('07:00'))).toEqual({ state: 'failed', error: 'QLDTraffic responded with 502' })
  })

  it('lists the roads once events have been read, even if a later refresh failed', () => {
    const b = roadsBriefing(commute, [event(1, 'Ipswich Motorway')], at('06:59'), 'timeout', at('07:00'))
    expect(b.state === 'ok' && b.events.map((e) => e.properties.id)).toEqual([1])
    expect(roadsBriefing(commute, [], at('06:59'), null, at('07:00'))).toEqual({ state: 'ok', events: [] })
  })
})

describe('firesNear', () => {
  const fire = (id: string, level: FireWarning['level'], lng: number) => ({ id, level, position: [lng, -27.47] }) as FireWarning
  it('keeps warnings within 25 km and leaves out plain incidents', () => {
    const near = firesNear([153.02, -27.47], [fire('a', 'Advice', 153.1), fire('b', 'Information', 153.05), fire('c', 'Watch and Act', 154)])
    expect(near.map((f) => f.id)).toEqual(['a'])
  })
})

describe('commuteAlerts', () => {
  const trip = (id: string, relationship: TripUpdate['relationship'] = 'scheduled') =>
    ({ key: `SEQ-${id}`, region: 'SEQ', tripId: id, route: 'BRCA', routeId: 'BRCA', relationship, stops: [] }) as TripUpdate
  const dep = (id: string, delay: number, tracked: boolean, relationship?: TripUpdate['relationship']): Departure => ({
    key: `SEQ-${id}:1`,
    trip: trip(id, relationship),
    stopId: 'rs1',
    time: at('07:40') + delay * 1000,
    scheduled: at('07:40'),
    delay,
    vehicle: tracked ? ({ id: 'v' } as LiveVehicle) : null,
    headsign: 'Caboolture station',
    direction: 0,
  })
  const names = () => ({ short: 'BRCA', line: 'T1 Caboolture' })

  it('alerts on closures and crashes, cancellations, tracked delays and nearby urgent fires', () => {
    const alerts = commuteAlerts(
      commute,
      {
        events: [event(1, 'Ipswich Motorway', { closure: true }), event(2, 'Ipswich Motorway', { type: 'Roadworks' })],
        departures: [dep('a', 420, true), dep('b', 420, false), dep('c', 0, false, 'cancelled'), dep('d', 60, true)],
        fires: [{ id: 'f', level: 'Watch and Act', title: 'Fire at Moggill', position: [152.9, -27.5], callToAction: 'Prepare to leave' } as FireWarning],
        stopName: 'Roma Street station',
        stopAt: [153.02, -27.47],
      },
      names,
      at('07:10'),
    )
    expect(alerts.map((a) => a.key)).toEqual(['event:1:closed', 'trip:SEQ-a:1:late5', 'trip:SEQ-c:1:cancelled', 'fire:f:Watch and Act'])
    expect(alerts[1].title).toBe('7 min late: 7:40 am T1 to Caboolture station from Roma Street station')
  })
})
