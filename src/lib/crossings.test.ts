import { describe, expect, it } from 'vitest'
import type { Camera, TrafficEvent } from '../api/types'
import { camera, roadEvent } from '../test/fixtures'
import { crossingNote, crossingStatus, crossingStatuses } from './crossings'

const now = Date.parse('2026-10-19T12:00:00+10:00')
const cam: Camera = camera(190, 'Mossman', [145.37, -16.46], 'floodcam')

const at = (id: number, coords: [number, number][], over: Partial<TrafficEvent['properties']> = {}): TrafficEvent => {
  const e = roadEvent(id, 'Mossman Daintree Road', 'Mossman', { event_type: 'Flooding' })
  return { ...e, geometry: { type: 'LineString', coordinates: coords }, properties: { ...e.properties, ...over } }
}
const closed = { direction: null, towards: null, impact_type: 'Closures', impact_subtype: 'Road closed to all traffic', delay: null }

describe('crossingStatus', () => {
  it('counts closures and flooding whose published points come within 1 km of the camera', () => {
    const s = crossingStatus(cam, [at(1, [[145.375, -16.46], [145.5, -16.5]], { impact: closed }), at(2, [[145.371, -16.461]]), at(3, [[145.6, -16.6]])], now)
    expect(s.closures.map((e) => e.properties.id)).toEqual([1])
    expect(s.flooding.map((e) => e.properties.id)).toEqual([2])
    expect(crossingNote(s)).toBe('Road closed within 1 km')
  })

  it('ignores other events nearby, and says only that nothing is listed when none is', () => {
    const crash = { ...at(4, [[145.37, -16.46]]), properties: { ...at(4, []).properties, event_type: 'Crash' as const } }
    const s = crossingStatus(cam, [crash], now)
    expect(s).toEqual({ closures: [], flooding: [] })
    expect(crossingNote(s)).toBe('Nothing listed within 1 km')
  })
})

describe('crossingStatuses', () => {
  it('gives every flood camera its status and skips traffic cameras', () => {
    const web = camera(5, 'Cairns', [145.37, -16.46], 'webcam')
    const m = crossingStatuses([cam, web], [at(1, [[145.371, -16.461]])], now, (c) => `${c.kind}-${c.properties.id}`)
    expect([...m.keys()]).toEqual(['floodcam-190'])
    expect(m.get('floodcam-190')?.flooding).toHaveLength(1)
  })
})
