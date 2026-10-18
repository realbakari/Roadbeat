import { describe, expect, it } from 'vitest'
import { camera, roadEvent } from '../test/fixtures'
import { isGeometry, parseCameras, parseEvents } from './qldtrafficFeed'

const collection = (features: unknown[], published?: string) => ({ type: 'FeatureCollection', features, ...(published ? { published } : {}) })

describe('parseEvents', () => {
  it('keeps well-formed events as published, extra fields included', () => {
    const e = roadEvent(1, 'Bruce Highway', 'Caboolture')
    const flood = { ...roadEvent(2, 'Ipswich Road', null, { event_type: 'Flooding' }), geometry: { type: 'Point', coordinates: [153, -27.5] } }
    const extra = { ...e.properties, id: 3, area_alert: true, alert_message: 'Avoid the area' }
    const { events, published } = parseEvents(collection([e, flood, { ...e, properties: extra }], '2026-10-17T10:00:00+10:00'))
    expect(events).toEqual([e, flood, { ...e, properties: extra }])
    expect(published).toBe('2026-10-17T10:00:00+10:00')
  })

  it('drops events with no id or type rather than failing the feed', () => {
    const e = roadEvent(1, 'Bruce Highway', 'Caboolture')
    const { id: _id, ...noId } = e.properties
    const events = parseEvents(collection([null, 'x', { ...e, properties: noId }, { ...e, properties: { ...e.properties, event_type: 7 } }, e])).events
    expect(events.map((x) => x.properties.id)).toEqual([1])
  })

  it('reads a wrongly typed field as not published, and unreadable geometry as none', () => {
    const e = roadEvent(1, 'Bruce Highway', 'Caboolture')
    const odd = { ...e, geometry: { type: 'LineString', coordinates: [[153, 'x']] }, properties: { ...e.properties, description: 42, road_summary: 'Bruce Highway', duration: { start: '2026-10-17', end: null, active_days: null, recurrences: [{ event_id: 9, description: null, impact: null }, { event_id: 'x' }] } } }
    const [p] = parseEvents(collection([odd])).events
    expect(p.geometry).toBeNull()
    expect(p.properties.description).toBeNull()
    expect(p.properties.road_summary).toBeNull()
    expect(p.properties.duration?.recurrences).toEqual([{ event_id: 9, description: null, impact: null }])
  })

  it('refuses a body that is not a feature collection', () => {
    expect(() => parseEvents({ error: 'x' })).toThrow()
    expect(parseEvents(collection([])).published).toBeNull()
  })
})

describe('parseCameras', () => {
  it('keeps cameras with a point and an image, and tags their kind', () => {
    const c = camera(5, 'Toowoomba', [151.95, -27.56])
    const { kind: _kind, ...feature } = c
    expect(parseCameras(collection([feature]), 'floodcam')).toEqual([{ ...c, kind: 'floodcam' }])
  })

  it('drops cameras without a usable point or image', () => {
    const { kind: _kind, ...c } = camera(5, 'Toowoomba', [151.95, -27.56])
    const bad = [
      { ...c, geometry: null },
      { ...c, geometry: { type: 'Point', coordinates: [151.95, -27.56, 10] } },
      { ...c, geometry: { type: 'Point', coordinates: ['151.95', -27.56] } },
      { ...c, properties: { ...c.properties, image_url: null } },
    ]
    expect(parseCameras(collection(bad), 'webcam')).toEqual([])
    expect(parseCameras(null, 'webcam')).toEqual([])
  })
})

describe('isGeometry', () => {
  it('checks positions at the depth each type nests them', () => {
    expect(isGeometry({ type: 'MultiLineString', coordinates: [[[153, -27], [153.1, -27.1]]] })).toBe(true)
    expect(isGeometry({ type: 'MultiLineString', coordinates: [[153, -27]] })).toBe(false)
    expect(isGeometry({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [153, -27] }] })).toBe(true)
    expect(isGeometry({ type: 'Circle', coordinates: [153, -27] })).toBe(false)
  })
})
