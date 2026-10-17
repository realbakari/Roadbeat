import { describe, expect, it } from 'vitest'
import type { WazeReport } from '../api/types'
import { placeMarkers } from './geo'
import { placeCard } from './mapCard'
import { wazeIcon, wazeLabel } from './waze'

// As displayed_waze_events.json published them on 17 October 2026.
const report = (type: string, subtype: string, street: string, city: string) =>
  ({ uuid: `${type}-${street}`, type, subtype, pubMillis: 0, reliability: 6, confidence: 0, nThumbsUp: 0, location: { x: 153, y: -27 }, street, city }) as WazeReport
const crash = report('ACCIDENT', '', 'Cardena Dr', 'Augustine Heights')
const lights = report('HAZARD', 'HAZARD_ON_ROAD_TRAFFIC_LIGHT_FAULT', 'Caboolture River Rd', 'Morayfield')

describe('wazeLabel', () => {
  it('names a report by its published type and subtype', () => {
    expect(wazeLabel(crash)).toBe('Crash')
    expect(wazeLabel(report('ACCIDENT', 'ACCIDENT_MINOR', '', ''))).toBe('Minor crash')
    expect(wazeLabel(lights)).toBe('Traffic light fault')
    expect(wazeLabel(report('HAZARD', 'HAZARD_ON_SHOULDER_CAR_STOPPED', '', ''))).toBe('Car stopped on shoulder')
    expect(wazeLabel(report('HAZARD', 'HAZARD_ON_ROAD', '', ''))).toBe('Hazard on road')
    expect(wazeLabel(report('HAZARD', '', '', ''))).toBe('Hazard')
    expect(wazeLabel(report('JAM', 'JAM_STAND_STILL_TRAFFIC', '', ''))).toBe('Stand still traffic')
  })

  it('draws crashes with a car and everything else with a warning sign', () => {
    expect(wazeIcon(crash)).toBe('waze')
    expect(wazeIcon(lights)).toBe('waze-hazard')
  })
})

describe('Waze reports on the map', () => {
  it('never calls a hazard a crash', () => {
    const card = placeCard({ kind: 'waze', data: lights })!
    expect(card.title).toBe('Caboolture River Rd, Morayfield')
    expect(card.subtitle).toBe('Traffic light fault reported by Waze users')
    expect(placeMarkers([], [], [lights]).features[0].properties).toMatchObject({ icon: 'waze-hazard', label: 'Waze: Traffic light fault · Caboolture River Rd' })
  })
})
