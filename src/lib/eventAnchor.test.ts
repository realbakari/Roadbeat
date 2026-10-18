import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { eventMarkerPoints, pointBounds } from './eventAnchor'
import { eventMarkers } from './geo'

const event = (id: number, geometry: TrafficEvent['geometry']) =>
  ({ type: 'Feature', geometry, properties: { id, event_type: 'Flooding', event_priority: 'High', impact: null } }) as unknown as TrafficEvent

// Geometries as QLDTraffic published them on 17 October 2026.
const claudeRiver = event(834662, {
  type: 'MultiPoint',
  coordinates: [
    [147.154994278, -24.459032387],
    [146.883129452, -24.490091094],
  ],
})
const lamington = event(796576, {
  type: 'GeometryCollection',
  geometries: [
    { type: 'LineString', coordinates: [[153.1054761, -28.1052752], [153.1052235, -28.1055082]] },
    { type: 'Point', coordinates: [153.109563, -28.1018383] },
    { type: 'Point', coordinates: [153.1122762, -28.1361911] },
  ],
})

describe('eventMarkerPoints', () => {
  it('pins every point of a MultiPoint, not only the first', () => {
    expect(eventMarkerPoints(claudeRiver)).toEqual([
      [147.154994278, -24.459032387],
      [146.883129452, -24.490091094],
    ])
  })

  it('pins every Point in a GeometryCollection, leaving its lines to the line layer', () => {
    expect(eventMarkerPoints(lamington)).toEqual([
      [153.109563, -28.1018383],
      [153.1122762, -28.1361911],
    ])
  })

  it('falls back to the middle of the line for an event with no points', () => {
    const line = event(1, { type: 'LineString', coordinates: [[153, -27], [153.1, -27.1], [153.2, -27.2]] })
    expect(eventMarkerPoints(line)).toEqual([[153.1, -27.1]])
  })

  it('gives an event with no geometry no marker', () => {
    expect(eventMarkerPoints(event(2, null))).toEqual([])
  })
})

describe('eventMarkers', () => {
  it('draws one marker per published point, each opening the same event', () => {
    const features = eventMarkers([claudeRiver]).features
    expect(features.map((f) => f.geometry)).toEqual([
      { type: 'Point', coordinates: [147.154994278, -24.459032387] },
      { type: 'Point', coordinates: [146.883129452, -24.490091094] },
    ])
    expect(features.map((f) => f.properties.id)).toEqual([834662, 834662])
  })
})

describe('pointBounds', () => {
  it('boxes the points from their south-west to north-east corners', () => {
    expect(pointBounds([[153.1, -27.5], [152.9, -27.4], [153.0, -27.6]])).toEqual([[152.9, -27.6], [153.1, -27.4]])
  })

  it('boxes a single point to itself', () => {
    expect(pointBounds([[153, -27.5]])).toEqual([[153, -27.5], [153, -27.5]])
  })

  it('gives null for no points', () => {
    expect(pointBounds([])).toBeNull()
  })
})
