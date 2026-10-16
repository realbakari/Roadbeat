import { describe, expect, it } from 'vitest'
import { HOTSPOTS_URL, hotspotAge, parseHotspots } from './hotspots'

// Cut down from the service's reply for Queensland on 17 October 2026.
const feature = (properties: Record<string, unknown>) => ({ type: 'Feature', geometry: null, properties })
const himawari = {
  id: 124633208,
  satellite: 'HIMAWARI-9',
  sensor: 'AHI',
  product: 'BRIGHT AHI',
  latitude: -13.6709,
  longitude: 143.0137,
  temp_kelvin: 300.2,
  datetime: '2026-10-15T18:06:50Z',
  confidence: 50,
  accuracy: '± 2km',
}
const viirs = { ...himawari, id: 124700001, satellite: 'NOAA 21', sensor: 'VIIRS', product: 'AFIMG', datetime: '2026-10-16T03:41:00Z', accuracy: '± 0.375km', confidence: 80 }

describe('parseHotspots', () => {
  it('reads each detection as published, newest first', () => {
    const [a, b] = parseHotspots({ type: 'FeatureCollection', features: [feature(himawari), feature(viirs)] })
    expect(a).toEqual({
      id: '124700001',
      position: [143.0137, -13.6709],
      observedAt: Date.parse('2026-10-16T03:41:00Z'),
      satellite: 'NOAA 21',
      sensor: 'VIIRS',
      product: 'AFIMG',
      confidence: 80,
      kelvin: 300.2,
      accuracy: '± 0.375km',
    })
    expect(b.satellite).toBe('HIMAWARI-9')
  })

  it('drops detections without a zoned time or a satellite, and keeps missing scores as null', () => {
    const list = parseHotspots({
      features: [
        feature({ ...himawari, datetime: '2026-10-15T18:06:50' }),
        feature({ ...himawari, satellite: '' }),
        feature({ ...himawari, latitude: null }),
        feature({ ...himawari, confidence: null, temp_kelvin: null, accuracy: null }),
      ],
    })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ confidence: null, kelvin: null, accuracy: null })
  })

  it('returns nothing for a reply that is not a feature collection', () => {
    expect(parseHotspots({ error: 'x' })).toEqual([])
    expect(parseHotspots(null)).toEqual([])
  })
})

describe('hotspotAge', () => {
  const at = Date.parse('2026-10-16T03:00:00Z')
  const h = (minutesAgo: number) => ({ ...parseHotspots({ features: [feature(viirs)] })[0], observedAt: at - minutesAgo * 60_000 })

  it('bands detections by the hours since the satellite saw them', () => {
    expect([h(59), h(60), h(359), h(360), h(1400)].map((x) => hotspotAge(x, at))).toEqual([0, 1, 1, 2, 2])
  })
})

describe('HOTSPOTS_URL', () => {
  it("asks only for Queensland's last 24 hours", () => {
    const q = new URL(HOTSPOTS_URL).searchParams
    expect(q.get('CQL_FILTER')).toBe("australian_state='QLD' AND hours_since_hotspot<24")
    expect(q.get('outputFormat')).toBe('application/json')
  })
})
