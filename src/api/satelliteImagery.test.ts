import { afterEach, describe, expect, it, vi } from 'vitest'
import { dailyLabel, dayBefore, gibsTiles, latestImageryDate } from './satelliteImagery'

afterEach(() => vi.unstubAllGlobals())

describe('gibsTiles', () => {
  it("builds GIBS's WMTS template, row before column", () => {
    expect(gibsTiles('2026-10-16')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-16/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    )
  })
})

describe('Terra', () => {
  it("builds Terra MODIS's address and labels it by date only", () => {
    expect(gibsTiles('2026-10-17', 'terra')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-10-17/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    )
    expect(dailyLabel('terra', '2026-10-17')).toBe('Terra MODIS true colour, morning pass, 17 Oct')
  })

  it("probes Terra's own layer for the newest day", async () => {
    const f = vi.fn(async (url: string) => new Response(null, { status: url.includes('MODIS_Terra') && url.includes('/2026-10-17/') ? 200 : 404 }))
    vi.stubGlobal('fetch', f)
    expect(await latestImageryDate('2026-10-18', undefined, 'terra')).toBe('2026-10-17')
  })
})

describe('dayBefore', () => {
  it('steps back across month and year ends', () => {
    expect(dayBefore('2026-11-01', 1)).toBe('2026-10-31')
    expect(dayBefore('2027-01-01', 3)).toBe('2026-12-29')
    expect(dayBefore('2026-10-16', 0)).toBe('2026-10-16')
  })
})

describe('latestImageryDate', () => {
  const answer = (published: string[]) =>
    vi.fn(async (url: string) => new Response(null, { status: published.some((d) => url.includes(`/${d}/`)) ? 200 : 404 }))

  it("takes today when NASA has published today's image", async () => {
    vi.stubGlobal('fetch', answer(['2026-10-16', '2026-10-15']))
    expect(await latestImageryDate('2026-10-16')).toBe('2026-10-16')
  })

  it('steps back to the newest published day', async () => {
    const f = answer(['2026-10-15'])
    vi.stubGlobal('fetch', f)
    expect(await latestImageryDate('2026-10-17')).toBe('2026-10-15')
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('gives null when none of the last four days is published', async () => {
    vi.stubGlobal('fetch', answer([]))
    expect(await latestImageryDate('2026-10-17')).toBeNull()
  })

  it('reports a server error instead of stepping past it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })))
    await expect(latestImageryDate('2026-10-17')).rejects.toThrow('503')
  })
})
