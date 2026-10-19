import { describe, expect, it } from 'vitest'
import { centsText, fuelNotice, fuelStatus, parseFuelData } from './fuelStations'

const raw = (prices: unknown[], sites?: unknown[]) => ({
  brands: { Brands: [{ BrandId: 86, Name: 'Liberty' }, { BrandId: 5, Name: 'BP ' }] },
  fuels: { Fuels: [{ FuelId: 2, Name: 'Unleaded' }, { FuelId: 3, Name: 'Diesel' }, { FuelId: 12, Name: 'e10' }, { FuelId: 4, Name: 'LPG' }] },
  regions: { GeographicRegions: [{ GeoRegionLevel: 1, GeoRegionId: 182624964, Name: 'Surat' }, { GeoRegionLevel: 2, GeoRegionId: 1, Name: 'Brisbane' }] },
  sites: {
    S: sites ?? [
      { S: 61290151, A: '61 Burrowes St', N: 'Liberty Surat', B: 86, P: '4417', G1: 182624964, G2: 178465038, Lat: -27.151627, Lng: 149.067712, M: '2019-07-15T05:32:17.627' },
      { S: 2, A: '', N: 'BP Nowhere', B: 5, P: '4000', G1: 0, Lat: 0, Lng: 0 },
      { S: 3, N: 'No prices', B: 999, Lat: -27.5, Lng: 153 },
    ],
  },
  prices: { SitePrices: prices },
})

describe('parseFuelData', () => {
  it('joins each site to its brand, suburb and prices, in tenths of a cent, listed in pump order', () => {
    const [surat, noPrices] = parseFuelData(
      raw([
        { SiteId: 61290151, FuelId: 3, CollectionMethod: 'Q', TransactionDateUtc: '2026-10-19T00:00:00', Price: 2079 },
        { SiteId: 61290151, FuelId: 2, CollectionMethod: 'Q', TransactionDateUtc: '2026-09-19T21:09:50.913', Price: 2399.0 },
        { SiteId: 61290151, FuelId: 12, CollectionMethod: 'Q', TransactionDateUtc: '2026-10-19T00:00:00', Price: 9999 },
      ]),
    )
    expect(surat).toMatchObject({ id: '61290151', name: 'Liberty Surat', brand: 'Liberty', address: '61 Burrowes St', postcode: '4417', suburb: 'Surat', status: 'partial', position: [149.067712, -27.151627] })
    expect(surat.fuels.map((f) => [f.name, f.cents, f.available])).toEqual([
      ['Unleaded', 239.9, true],
      ['e10', null, false],
      ['Diesel', 207.9, true],
    ])
    // The API's times have no zone and are UTC.
    expect(surat.fuels[0].reportedAt).toBe(Date.parse('2026-09-19T21:09:50.913Z'))
    // A site out of Queensland's bounds is dropped; one with no prices is kept, with nothing reported.
    expect(noPrices).toMatchObject({ id: '3', brand: null, suburb: null, fuels: [], status: 'unknown' })
  })

  it('drops prices for unknown fuels, with unreadable times, or of the wrong shape', () => {
    const [surat] = parseFuelData(
      raw([
        { SiteId: 61290151, FuelId: 77, TransactionDateUtc: '2026-10-19T00:00:00', Price: 1999 },
        { SiteId: 61290151, FuelId: 2, TransactionDateUtc: 'soon', Price: 1999 },
        { SiteId: 61290151, FuelId: 2, Price: 1999 },
        { SiteId: 61290151, FuelId: 4, TransactionDateUtc: '2026-10-19T00:00:00', Price: 1099 },
      ]),
    )
    expect(surat.fuels.map((f) => f.name)).toEqual(['LPG'])
  })
})

describe('fuelStatus', () => {
  const f = (available: boolean) => ({ id: 1, name: 'x', cents: available ? 1 : null, available, reportedAt: 0 })
  it('says none, some or all of a site’s reported fuels are unavailable, and unknown when it reports none', () => {
    expect([fuelStatus([f(true), f(true)]), fuelStatus([f(true), f(false)]), fuelStatus([f(false)]), fuelStatus([])]).toEqual(['available', 'partial', 'unavailable', 'unknown'])
  })
})

describe('fuelNotice and centsText', () => {
  it('gives the licence’s notice with the year, and prices to a tenth of a cent', () => {
    expect(fuelNotice(2026)).toMatch(/^Based on or contains data provided by the State of Queensland \(Department of Energy and Climate\) 2026\. /)
    expect(centsText(189.9)).toBe('189.9')
    expect(centsText(200)).toBe('200.0')
  })
})
