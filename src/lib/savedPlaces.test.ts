import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { roadEvent } from '../test/fixtures'
import { placeSummary, removePlace, savePlace, type SavedPlace } from './savedPlaces'

const toowong: SavedPlace = { name: 'Toowong', nickname: 'Home', position: [152.9817, -27.4847] }

const at = (e: TrafficEvent, position: [number, number], closed = false): TrafficEvent => ({
  ...e,
  geometry: { type: 'Point', coordinates: position },
  properties: { ...e.properties, impact: { ...e.properties.impact!, impact_type: closed ? 'Closures' : 'Lanes', impact_subtype: closed ? 'Road closed to all traffic' : null } },
})

describe('savePlace', () => {
  it('adds a place, renames it in place, and falls back to its own name for a blank nickname', () => {
    const one = savePlace([], toowong)
    expect(one).toEqual([toowong])
    expect(savePlace(one, { ...toowong, nickname: '  Work ' })).toEqual([{ ...toowong, nickname: 'Work' }])
    expect(savePlace([], { ...toowong, nickname: ' ' })[0].nickname).toBe('Toowong')
    expect(removePlace(one, 'Toowong')).toEqual([])
  })
})

describe('placeSummary', () => {
  it('counts current road events and closures within 5 km of the place', () => {
    const near = at(roadEvent(1, 'Milton Road', 'Toowong'), [152.99, -27.48], true)
    const alsoNear = at(roadEvent(2, 'Coronation Drive', 'Toowong'), [152.995, -27.475])
    const far = at(roadEvent(3, 'Bruce Highway', 'Caboolture'), [152.95, -27.07])
    expect(placeSummary(toowong, [near, alsoNear, far], Date.now())).toEqual({ events: 2, closures: 1 })
  })
})
