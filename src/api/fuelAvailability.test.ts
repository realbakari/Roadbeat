import { describe, expect, it } from 'vitest'
import { FUEL_FIELDS, parseFuelStations } from './fuelAvailability'

const feature = (props: Record<string, unknown>, coordinates: [number, number] = [152.58251, -25.7305]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: props })

describe('parseFuelStations', () => {
  it('reads a station, its overall status and each fuel it lists', () => {
    const { stations, more } = parseFuelStations({
      features: [
        feature({
          Site_Id: 61402699,
          Service_Station_Name: 'United Tiaro',
          Brand_Name: 'United',
          Location: '15 Mayne St, Tiaro',
          Postcode: 4650,
          lga_name: 'Fraser Coast Regional',
          Outage_Type: 'Fuel Partially Available',
          Information_Last_Updated: 1791947110000,
          Unleaded_91: 'Available',
          Diesel: 'Unavailable',
          LPG: null,
        }),
      ],
    })
    expect(more).toBe(false)
    expect(stations).toEqual([
      {
        id: '61402699',
        name: 'United Tiaro',
        brand: 'United',
        address: '15 Mayne St, Tiaro',
        postcode: 4650,
        council: 'Fraser Coast Regional',
        status: 'partial',
        updatedAt: 1791947110000,
        fuels: [
          { name: 'Unleaded 91', available: true },
          { name: 'Diesel', available: false },
        ],
        position: [152.58251, -25.7305],
      },
    ])
  })

  it('treats a status it does not know, or no update time, as unknown rather than guessing', () => {
    const [s] = parseFuelStations({ features: [feature({ Site_Id: 1, Outage_Type: 'Something new', Information_Last_Updated: null })] }).stations
    expect(s.status).toBe('unknown')
    expect(s.updatedAt).toBeNull()
    expect(s.fuels).toEqual([])
  })

  it('leaves out features with no point or no site id, and says when the service has more pages', () => {
    const out = parseFuelStations({ exceededTransferLimit: true, features: [{ geometry: null, properties: { Site_Id: 2 } }, feature({ Service_Station_Name: 'No id' })] })
    expect(out.stations).toEqual([])
    expect(out.more).toBe(true)
    expect(parseFuelStations(null).stations).toEqual([])
  })
})

describe('FUEL_FIELDS', () => {
  it('asks the layer for availability only, never a price', () => {
    expect(FUEL_FIELDS).toContain('Outage_Type')
    expect(FUEL_FIELDS.some((f) => /price/i.test(f))).toBe(false)
  })
})
