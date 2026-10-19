import { describe, expect, it } from 'vitest'
import type { FuelStation } from '../api/fuelStations'
import { brandCounts, brandedName, byBrand, cheapestIn, fuelNames, priceLabel } from './fuelBrands'

const station = (name: string, brand: string | null): FuelStation => ({ id: name, name, brand, address: null, postcode: null, suburb: null, status: 'available', fuels: [], position: [153, -27] })

const stations = [station('Ampol Dalby', 'Ampol'), station('Dalby Truck Stop', 'Ampol'), station('7-Eleven Nerang', '7 Eleven'), station('Joe’s Fuel', 'Independent'), station('No brand', null)]

describe('brandCounts', () => {
  it('counts stations per brand, most first', () => {
    expect(brandCounts(stations)).toEqual([
      ['Ampol', 2],
      ['7 Eleven', 1],
      ['Independent', 1],
    ])
  })
})

describe('byBrand', () => {
  it('keeps the chosen brands, or everything when none is chosen', () => {
    expect(byBrand(stations, ['Ampol']).map((s) => s.name)).toEqual(['Ampol Dalby', 'Dalby Truck Stop'])
    expect(byBrand(stations, [])).toHaveLength(5)
  })
})

describe('brandedName', () => {
  it('adds the brand only when the name does not already say it', () => {
    expect(brandedName(stations[0])).toBe('Ampol Dalby')
    expect(brandedName(stations[1])).toBe('Ampol · Dalby Truck Stop')
    expect(brandedName(stations[2])).toBe('7-Eleven Nerang')
    expect(brandedName(stations[3])).toBe('Joe’s Fuel')
  })
})

describe('fuelNames and priceLabel', () => {
  const at = 0
  const priced = { ...station('Ampol Dalby', 'Ampol'), fuels: [{ id: 2, name: 'Unleaded', cents: 189.9, available: true, reportedAt: at }, { id: 3, name: 'Diesel', cents: null, available: false, reportedAt: at }] }
  const other = { ...station('BP', 'BP'), fuels: [{ id: 2, name: 'Unleaded', cents: 200, available: true, reportedAt: at }] }

  it('lists the fuels stations report, most stations first', () => {
    expect(fuelNames([priced, other])).toEqual(['Unleaded', 'Diesel'])
  })

  it('labels a station with the fuel’s price, "Out" when unavailable, and nothing when it doesn’t sell it', () => {
    expect([priceLabel(priced, 'Unleaded'), priceLabel(priced, 'Diesel'), priceLabel(other, 'Diesel'), priceLabel(other, 'Unleaded')]).toEqual(['189.9', 'Out', null, '200.0'])
  })
})

describe('cheapestIn', () => {
  const at = (name: string, position: [number, number], cents: number | null) => ({ ...station(name, null), position, fuels: [{ id: 2, name: 'Unleaded', cents, available: cents != null, reportedAt: 0 }] })
  const stations = [at('A', [153, -27.5], 199.9), at('B', [153.1, -27.5], 189.9), at('C', [153.2, -27.5], 189.9), at('D', [149, -27], 159.9), at('E', [153, -27.6], null)]
  const brisbane: [[number, number], [number, number]] = [[152.5, -28], [153.5, -27]]

  it('finds the lowest price in view and marks every station at it', () => {
    const c = cheapestIn(stations, 'Unleaded', brisbane)
    expect(c?.cents).toBe(189.9)
    expect([...(c?.ids ?? [])]).toEqual(['B', 'C'])
  })

  it('looks everywhere without bounds, ignores unavailable fuels, and is null when nothing in view has a price', () => {
    expect(cheapestIn(stations, 'Unleaded', null)?.cents).toBe(159.9)
    expect(cheapestIn([stations[4]], 'Unleaded', null)).toBeNull()
    expect(cheapestIn(stations, '', null)).toBeNull()
  })
})
