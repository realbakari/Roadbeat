import { afterEach, describe, expect, it, vi } from 'vitest'
import { domainsUrl, himawariFrames, himawariLabel, himawariTiles, latestDomainTime, latestHimawariTime } from './himawari'

afterEach(() => vi.unstubAllGlobals())

// DescribeDomains answers from GIBS, 17 October 2026, word for word.
const TWO_DAYS =
  "<Domains xmlns:ows='http://www.opengis.net/ows/1.1'><SpaceDomain><BoundingBox miny='-20037508.342789' crs='urn:ogc:def:crs:EPSG::3857' minx='-20037508.342789' maxy='20037508.342789' maxx='20037508.342789'/></SpaceDomain><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>2026-10-16/2026-10-16T02:30:00Z/PT10M,2026-10-16T02:50:00Z/2026-10-16T14:30:00Z/PT10M,2026-10-16T14:50:00Z/2026-10-17T02:30:00Z/PT10M,2026-10-17T02:50:00Z/2026-10-17T13:10:00Z/PT10M</Domain><Size>4</Size></DimensionDomain></Domains>"
const CUT_AT_WINDOW_END =
  "<Domains xmlns:ows='http://www.opengis.net/ows/1.1'><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>2026-10-16/2026-10-16T02:30:00Z/PT10M,2026-10-16T14:50:00Z/2026-10-17/PT10M</Domain><Size>2</Size></DimensionDomain></Domains>"
const EMPTY =
  "<Domains xmlns:ows='http://www.opengis.net/ows/1.1'><SpaceDomain><BoundingBox minx='-20037508.342789' miny='-20037508.342789' maxx='20037508.342789' maxy='20037508.342789' crs='urn:ogc:def:crs:EPSG::3857'/></SpaceDomain><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain></Domain><Size>0</Size></DimensionDomain></Domains>"

const NOW = Date.parse('2026-10-17T13:34:00Z')

describe('himawariTiles', () => {
  it("builds each band's GIBS address at its own zoom limit", () => {
    expect(himawariTiles('infrared', '2026-10-17T13:00:00Z')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/2026-10-17T13:00:00Z/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
    )
    expect(himawariTiles('visible', '2026-10-17T02:00:00Z')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band3_Red_Visible_1km/default/2026-10-17T02:00:00Z/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    )
  })
})

describe('domainsUrl', () => {
  it('asks for the UTC days either side of now, past the CDN copy', () => {
    expect(domainsUrl('infrared', NOW)).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/Himawari_AHI_Band13_Clean_Infrared/default/GoogleMapsCompatible_Level6/all/2026-10-16--2026-10-18.xml?minute=29870734',
    )
  })
})

describe('latestDomainTime', () => {
  it("takes the last range's end", () => {
    expect(latestDomainTime(TWO_DAYS)).toBe('2026-10-17T13:10:00Z')
  })
  it('reads a bare date as midnight UTC', () => {
    expect(latestDomainTime(CUT_AT_WINDOW_END)).toBe('2026-10-17T00:00:00Z')
  })
  it('gives null when no time is listed or the document is not one', () => {
    expect(latestDomainTime(EMPTY)).toBeNull()
    expect(latestDomainTime('<html>Service unavailable</html>')).toBeNull()
  })
})

describe('himawariFrames', () => {
  it('lists every published time from DescribeDomains', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(TWO_DAYS)))
    expect((await himawariFrames('infrared', NOW)).slice(-2)).toEqual(['2026-10-17T13:00:00Z', '2026-10-17T13:10:00Z'])
  })
})

describe('latestHimawariTime', () => {
  it('reads the newest time from DescribeDomains', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(TWO_DAYS)))
    expect(await latestHimawariTime('infrared', NOW)).toBe('2026-10-17T13:10:00Z')
  })
  it('throws on an error answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(latestHimawariTime('infrared', NOW)).rejects.toThrow('503')
  })
})

describe('labels', () => {
  it('writes the image time in AEST with its age', () => {
    expect(himawariLabel('infrared', '2026-10-17T13:20:00Z', NOW)).toBe('Himawari-9 infrared, 11:20 pm AEST, 14 min ago')
  })
})
