import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS } from '../components/map/settings'
import type { Outage } from '../api/newsTypes'
import { layerCounts, layerInfo, layerTimes, type LayerCountData } from './layerInfo'

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

describe('layerCounts', () => {
  const none: LayerCountData = {
    cameras: [],
    restAreas: [],
    dumpPoints: [],
    trucks: [],
    waze: [],
    fires: null,
    warnings: null,
    gauges: null,
    signalVolumes: null,
    clearances: null,
    clearways: null,
    toilets: null,
    accessibleParking: null,
    parkingMeters: null,
    cycling: null,
    councilEvents: null,
    news: null,
    airQuality: null,
    hotspots: null,
    stories: null,
    mapStories: [],
  }

  it('counts the always-loaded layers, splitting cameras by kind', () => {
    expect(layerCounts({ ...none, cameras: [{ kind: 'webcam' }, { kind: 'floodcam' }, { kind: 'webcam' }], waze: [1, 2] })).toEqual({
      webcams: 2,
      floodcams: 1,
      restAreas: 0,
      dumpPoints: 0,
      trucks: 0,
      waze: 2,
    })
  })

  it('gives no count for a feed not yet loaded, and 0 for one that loaded empty', () => {
    const c = layerCounts({ ...none, fires: [], toilets: [1, 2, 3] })
    expect(c.fires).toBe(0)
    expect(c.toilets).toBe(3)
    expect(c).not.toHaveProperty('gauges')
    expect(c).not.toHaveProperty('signals')
  })

  it('counts signals by their volume sites and outages only where they are placed', () => {
    const placed = { place: { name: 'Chuwar', position: [152.8, -27.5] }, geometry: null } as unknown as Outage
    const unplaced = { place: null, geometry: null } as unknown as Outage
    const c = layerCounts({ ...none, signalVolumes: { size: 4 }, news: { centres: [1], outages: [placed, unplaced] } })
    expect(c).toMatchObject({ signals: 4, councilCentres: 1, outages: 1 })
  })

  it('counts the stories on the map once the news has loaded', () => {
    expect(layerCounts({ ...none, stories: [1, 2, 3], mapStories: [1] }).news).toBe(1)
    expect(layerCounts({ ...none, mapStories: [1] })).not.toHaveProperty('news')
  })
})
