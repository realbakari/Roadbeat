import { describe, expect, it } from 'vitest'
import { parseJmaTimes } from '../api/jmaHimawari'
import TIMES from '../test/jmaTimes.json'
import { satelliteTiles, type SatelliteFrames } from './satelliteImage'

const FRAMES: SatelliteFrames = { gibsTime: '2026-10-17T13:10:00Z', jmaFrame: parseJmaTimes(TIMES).at(-1)!, date: '2026-10-16' }

describe('satelliteTiles', () => {
  it("draws GIBS's Himawari-9 at the listed time, capped at the band's zoom", () => {
    expect(satelliteTiles('infrared', FRAMES)).toEqual({
      tiles: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/2026-10-17T13:10:00Z/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
      minzoom: 0,
      maxzoom: 6,
      attribution: 'Himawari-9 imagery: Japan Meteorological Agency, served by NASA GIBS (ESDIS), image 17 Oct, 11:10 pm AEST',
    })
    expect(satelliteTiles('visible', FRAMES)?.maxzoom).toBe(7)
  })

  it("draws JMA's listed image between zoom 3 and 5, citing JMA", () => {
    expect(satelliteTiles('jma-truecolour', FRAMES)).toEqual({
      tiles: 'https://www.jma.go.jp/bosai/himawari/data/satimg/20261017135000/fd/20261017135000/REP/ETC/{z}/{x}/{y}.jpg',
      minzoom: 3,
      maxzoom: 5,
      attribution: 'Himawari-9: Source: Japan Meteorological Agency website (https://www.jma.go.jp/), image 17 Oct, 11:50 pm AEST',
    })
  })

  it("draws the chosen day's NOAA-20 or Terra image", () => {
    expect(satelliteTiles('noaa20', FRAMES)?.tiles).toContain('/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-16/')
    expect(satelliteTiles('terra', FRAMES)?.tiles).toContain('/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-10-16/')
  })

  it('draws nothing until the chosen source has published something', () => {
    const none: SatelliteFrames = { gibsTime: null, jmaFrame: null, date: null }
    for (const s of ['infrared', 'jma-infrared', 'noaa20', 'terra'] as const) expect(satelliteTiles(s, none)).toBeNull()
  })
})
