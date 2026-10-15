import { describe, expect, it } from 'vitest'
import { dayStart, tripsOnDay, type RouteFile } from './timetables'

// Two services over a 6-day window starting Mon 12 Oct 2026:
// service 0 runs Mon–Fri (bits 0–4), service 1 runs Sat only (bit 5).
const route: RouteFile = {
  region: 'SEQ',
  route: 'BRCA',
  start: '2026-10-12',
  days: 6,
  stops: ['600001', '600002', '600003'],
  heads: ['Caboolture station'],
  // Hex digit i holds days 4i..4i+3, lowest bit first.
  services: ['f1', '02'],
  patterns: [
    // Three stops: departs 0, 5, 12 minutes after the first; waits 1 minute at the second; drop-off only at the last.
    [1, [0, 1, 2], [0, 5, 12], '00d', [0, 1, 0]],
  ],
  trips: [
    [0, 8 * 60, 0, 0, 101], // 8:00am weekdays
    [0, 25 * 60 + 30, 1, 0, 102], // 1:30am the next morning, Saturday service
  ],
}

const at = (date: string, hhmm: string) => dayStart(date) + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60_000

describe('tripsOnDay', () => {
  it('lists only the trips whose service runs that day', () => {
    expect(tripsOnDay(route, '2026-10-14').map((t) => t.number)).toEqual([101])
    expect(tripsOnDay(route, '2026-10-17').map((t) => t.number)).toEqual([102])
  })

  it('returns nothing outside the timetable window', () => {
    expect(tripsOnDay(route, '2026-10-11')).toEqual([])
    expect(tripsOnDay(route, '2026-10-18')).toEqual([])
  })

  it('turns minute offsets into Brisbane times, keeping published arrivals', () => {
    const [trip] = tripsOnDay(route, '2026-10-14')
    expect(trip.headsign).toBe('Caboolture station')
    expect(trip.direction).toBe(1)
    expect(trip.stops.map((s) => s.stopId)).toEqual(['600001', '600002', '600003'])
    expect(trip.stops[1].time).toBe(at('2026-10-14', '08:05'))
    expect(trip.stops[1].arrival).toBe(at('2026-10-14', '08:04'))
    expect(trip.stops[2].kind).toBe('arrival')
  })

  it('keeps times past midnight on the service day they belong to', () => {
    const [trip] = tripsOnDay(route, '2026-10-17')
    expect(trip.stops[0].time).toBe(at('2026-10-18', '01:30'))
  })
})
