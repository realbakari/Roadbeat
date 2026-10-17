import { describe, expect, it } from 'vitest'
import type { TruckRestriction } from '../api/types'
import { findPlace, placeFocus, type PlaceSources } from './places'
import { truckLines } from './geo'
import { findTruck, truckIconPoint, truckKey, truckSubtitle } from './trucks'

// Cut down from restrictedtruck.geojson as published on 17 October 2026: both features have id 1 and no feature id.
const buc = {
  type: 'Feature',
  geometry: { type: 'MultiLineString', coordinates: [[[153.116, -27.545], [153.06, -27.55], [153.01, -27.557]]] },
  properties: { id: 1, name: 'Truck restrictions', originterm: 'Brisbane Urban Corridor, Mansfield', destinationterm: 'Brisbane Urban Corridor, Rocklea', description: '', suburbs: '', roads: '', moreinformation: null },
} as unknown as TruckRestriction
const m1 = {
  type: 'Feature',
  geometry: { type: 'MultiLineString', coordinates: [[[153.13, -27.62], [153.2, -27.8], [153.32, -28.07]]] },
  properties: { id: 1, name: 'Pacific Motorway truck lane restrictions', description: '', suburbs: 'Springwood - Mudgeeraba', roads: 'Pacific Motorway', moreinformation: null },
} as unknown as TruckRestriction

describe('truck restriction keys', () => {
  it('gives each restriction its own key though the feed gives both id 1', () => {
    expect(truckKey(buc)).toBe('1-truck-restrictions')
    expect(truckKey(m1)).toBe('1-pacific-motorway-truck-lane-restrictions')
    expect(truckLines([buc, m1]).features.map((f) => f.properties.key)).toEqual([
      'place/truck/1-truck-restrictions',
      'place/truck/1-truck-restrictions',
      'place/truck/1-pacific-motorway-truck-lane-restrictions',
      'place/truck/1-pacific-motorway-truck-lane-restrictions',
    ])
  })

  it('opens the restriction that was tapped', () => {
    const sources = { truckRestrictions: [buc, m1] } as unknown as PlaceSources
    expect(findPlace({ kind: 'truck', id: truckKey(m1) }, sources)?.data).toBe(m1)
    expect(findTruck([buc, m1], '1')).toBeNull()
    expect(findTruck([m1], '1')).toBe(m1)
  })

  it('flies to the icon that was tapped, not the first vertex', () => {
    expect(truckIconPoint(m1)).toEqual([153.2, -27.8])
    expect(placeFocus({ kind: 'truck', data: m1 })?.center).toEqual([153.2, -27.8])
    const icon = truckLines([m1]).features.find((f) => f.geometry.type === 'Point')
    expect(icon?.geometry).toEqual({ type: 'Point', coordinates: [153.2, -27.8] })
  })

  it("doesn't print 'undefined to undefined' for a restriction with no ends", () => {
    expect(truckSubtitle(buc)).toBe('Brisbane Urban Corridor, Mansfield to Brisbane Urban Corridor, Rocklea')
    expect(truckSubtitle(m1)).toBeNull()
  })
})
