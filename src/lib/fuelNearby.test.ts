import { describe, expect, it } from 'vitest'
import type { FuelPrice, FuelStation } from '../api/fuelStations'
import { fuelAreas, fuelNear, matchAreas } from './fuelNearby'

const NOW = Date.parse('2026-10-20T04:00:00Z')
const DAY = 86_400_000
const HERE: [number, number] = [153.02, -27.47]

function station(id: string, kmEast: number, price: Partial<FuelPrice> | null, suburb = 'BRISBANE CITY', postcode = '4000'): FuelStation {
  // About 0.0101° of longitude is 1 km at this latitude.
  const fuels: FuelPrice[] = price ? [{ id: 2, name: 'Unleaded', cents: 189.9, available: true, reportedAt: NOW - 600_000, ...price }] : []
  return { id, name: `Station ${id}`, brand: null, address: null, postcode, suburb, fuels, status: 'available', position: [HERE[0] + kmEast * 0.0101, HERE[1]] }
}

describe('fuelNear', () => {
  const stations = [
    station('near-dear', 1, { cents: 199.9 }),
    station('far-cheap', 8, { cents: 179.9 }),
    station('old-cheaper', 2, { cents: 159.9, reportedAt: NOW - 45 * DAY }),
    station('out', 3, { cents: null, available: false }),
    station('too-far', 30, { cents: 149.9 }),
    station('no-unleaded', 1, null),
  ]

  it('sorts fresh prices cheapest first, then older prices, then unavailable, and calls only a fresh price the cheapest', () => {
    const rows = fuelNear(stations, 'Unleaded', HERE, 10, 'cheapest', NOW)
    expect(rows.map((r) => [r.station.id, r.cheapest])).toEqual([
      ['far-cheap', true],
      ['near-dear', false],
      ['old-cheaper', false],
      ['out', false],
    ])
    expect(rows.find((r) => r.station.id === 'old-cheaper')?.fresh).toBe(false)
  })

  it('sorts by distance for nearest, and keeps to the radius', () => {
    expect(fuelNear(stations, 'Unleaded', HERE, 5, 'nearest', NOW).map((r) => r.station.id)).toEqual(['near-dear', 'old-cheaper', 'out'])
    expect(fuelNear(stations, 'Unleaded', HERE, 5, 'nearest', NOW)[0].km).toBeCloseTo(1, 0)
  })
})

describe('fuelAreas and matchAreas', () => {
  const areas = fuelAreas([station('a', 0, {}, 'WOOLLOONGABBA', '4102'), station('b', 2, {}, 'WOOLLOONGABBA', '4102'), station('c', 5, {}, 'EAST BRISBANE', '4169')])

  it('names each suburb as the state files it, centred on its stations', () => {
    expect(areas.map((a) => [a.name, a.postcode, a.stations])).toEqual([
      ['East Brisbane', '4169', 1],
      ['Woolloongabba', '4102', 2],
    ])
    expect(areas[1].center[0]).toBeCloseTo(HERE[0] + 0.0101, 4)
  })

  it('matches the start of a name or postcode first, then anywhere in a name', () => {
    expect(matchAreas(areas, 'wool').map((a) => a.name)).toEqual(['Woolloongabba'])
    expect(matchAreas(areas, '4169').map((a) => a.name)).toEqual(['East Brisbane'])
    expect(matchAreas(areas, 'brisbane').map((a) => a.name)).toEqual(['East Brisbane'])
    expect(matchAreas(areas, '  ')).toEqual([])
  })
})
