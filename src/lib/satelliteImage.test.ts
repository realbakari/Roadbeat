import { describe, expect, it } from 'vitest'
import { satelliteTiles } from './satelliteImage'

describe('satelliteTiles', () => {
  it("draws Himawari-9 at the listed time, capped at the band's zoom", () => {
    expect(satelliteTiles('infrared', '2026-10-17T13:10:00Z', '2026-10-16')).toEqual({
      tiles: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/2026-10-17T13:10:00Z/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
      maxzoom: 6,
      attribution: 'Himawari-9 imagery: Japan Meteorological Agency, served by NASA GIBS (ESDIS), image 17 Oct, 11:10 pm AEST',
    })
    expect(satelliteTiles('visible', '2026-10-17T02:00:00Z', null)?.maxzoom).toBe(7)
  })

  it("draws NASA's daily image for the chosen day only when daily is chosen", () => {
    expect(satelliteTiles('daily', '2026-10-17T13:10:00Z', '2026-10-16')?.tiles).toContain('/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-16/')
  })

  it('draws nothing until a time or day is known', () => {
    expect(satelliteTiles('infrared', null, '2026-10-16')).toBeNull()
    expect(satelliteTiles('daily', '2026-10-17T13:10:00Z', null)).toBeNull()
  })
})
