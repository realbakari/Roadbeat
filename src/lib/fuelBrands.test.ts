import { describe, expect, it } from 'vitest'
import type { FuelStation } from '../api/fuelAvailability'
import { brandCounts, brandedName, byBrand } from './fuelBrands'

const station = (name: string, brand: string | null): FuelStation => ({ id: name, name, brand, address: null, postcode: null, council: null, status: 'available', updatedAt: null, fuels: [], position: [153, -27] })

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
