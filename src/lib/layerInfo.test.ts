import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS } from '../components/map/settings'
import { layerInfo, layerTimes } from './layerInfo'

describe('layerInfo', () => {
  it("gives a layer its feed's publisher and read cadence from the registry", () => {
    expect(layerInfo('webcams')).toEqual({ publisher: 'Transport and Main Roads (TMR)', cadence: 'Read every 5 min' })
    expect(layerInfo('gauges')?.publisher).toContain(' and ')
  })

  it("uses the registry's note for a feed read on demand", () => {
    expect(layerInfo('crashes')).toEqual({ publisher: 'TMR, data.qld.gov.au', cadence: 'On demand (CKAN SQL)' })
  })

  it('leaves out layers whose own note already says this', () => {
    expect(layerInfo('fires')).toBeNull()
    expect(layerInfo('warnings')).toBeNull()
    expect(layerInfo('hotspots')).toBeNull()
  })

  it('covers every other layer except 3D buildings and the static flood extent, whose notes say where they come from', () => {
    const missing = (Object.keys(DEFAULT_LAYERS) as (keyof typeof DEFAULT_LAYERS)[]).filter((k) => !layerInfo(k))
    expect(missing.sort()).toEqual(['buildings3d', 'fires', 'flood2022', 'hotspots', 'warnings'])
  })
})

describe('layerTimes', () => {
  it("takes each layer's newest published time, and the read time where the feed has none", () => {
    const t = layerTimes({
      gauges: [{ readings: [{ time: 100 }, { time: 300 }] }, { readings: [{ time: 200 }] }],
      airStations: [{ measuredAt: 50 }],
      cyclones: [],
      newsReadAt: 400,
      nswReadAt: null,
    })
    expect(t).toEqual({
      gauges: { at: 300, label: 'Latest reading' },
      airQuality: { at: 50, label: 'Measured hour' },
      news: { at: 400, label: 'Feeds read' },
      councilCentres: { at: 400, label: 'Feeds read' },
      outages: { at: 400, label: 'Feeds read' },
    })
  })
})
