import { describe, expect, it } from 'vitest'
import { parseForecast, upcoming } from './modelForecast'

// The shape Open-Meteo returned for Brisbane on 17 October 2026.
const JSON_ = {
  latitude: -27.5,
  longitude: 153.0,
  utc_offset_seconds: 36000,
  timezone: 'Australia/Brisbane',
  hourly: {
    time: ['2026-10-17T22:00', '2026-10-17T23:00', '2026-10-18T00:00'],
    precipitation: [0, 0.4, null],
    wind_speed_10m: [9.4, 11.2, 12],
    wind_gusts_10m: [20.5, 24.1, 25],
    temperature_2m: [19.1, 18.6, 18.2],
  },
}

describe('parseForecast', () => {
  it('turns local hours into instants using the stated offset, keeping gaps as null', () => {
    const f = parseForecast(JSON_, Date.UTC(2026, 9, 17, 6))!
    expect(f.gridPoint).toEqual([153, -27.5])
    expect(f.runAt).toBe(Date.UTC(2026, 9, 17, 6))
    expect(f.hours[0]).toEqual({ time: Date.parse('2026-10-17T22:00:00+10:00'), rainMm: 0, windKmh: 9.4, gustKmh: 20.5, tempC: 19.1 })
    expect(f.hours[2].rainMm).toBeNull()
  })

  it('gives null for a reply without hours or a grid point', () => {
    expect(parseForecast({ error: true, reason: 'x' }, null)).toBeNull()
    expect(parseForecast({ ...JSON_, latitude: undefined }, null)).toBeNull()
  })
})

describe('upcoming', () => {
  it('starts at the current hour', () => {
    const f = parseForecast(JSON_, null)!
    const now = Date.parse('2026-10-17T23:20:00+10:00')
    expect(upcoming(f, now, 5).map((h) => new Date(h.time).toISOString())).toEqual(['2026-10-17T13:00:00.000Z', '2026-10-17T14:00:00.000Z'])
  })
})
