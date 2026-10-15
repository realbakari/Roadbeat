import { describe, expect, it } from 'vitest'
import { parseRoadSegments, roadQueryUrl } from './qldRoads'

describe('roadQueryUrl', () => {
  it('asks for the named roads with either side in a named locality, escaping apostrophes', () => {
    const where = new URL(roadQueryUrl(['Avaline Boulevard', "O'Connell Street"], ['Burpengary East']) ?? '').searchParams.get('where')
    expect(where).toBe(
      "road_name_full IN ('Avaline Boulevard','O''Connell Street') AND (locality_left IN ('Burpengary East') OR locality_right IN ('Burpengary East'))",
    )
  })

  it('leaves out names with other characters, and asks nothing when none are left', () => {
    expect(roadQueryUrl(["X Road'); DROP"], ['Burpengary East'])).toBeNull()
    expect(roadQueryUrl(['Avaline Boulevard'], [])).toBeNull()
  })
})

describe('parseRoadSegments', () => {
  it('reads each part of each segment, dropping unnamed or empty ones', () => {
    const json = {
      features: [
        { attributes: { road_name_full: 'Avaline Boulevard', locality_left: 'Burpengary East', locality_right: 'Narangba' }, geometry: { paths: [[[152.99306, -27.15691], [152.99213, -27.15678]], [[1, 1]]] } },
        { attributes: { road_name_full: null, locality_left: 'X', locality_right: 'X' }, geometry: { paths: [[[0, 0], [1, 1]]] } },
        { attributes: { road_name_full: 'Y Road', locality_left: 'X', locality_right: 'X' }, geometry: null },
      ],
    }
    expect(parseRoadSegments(json)).toEqual([
      { road: 'Avaline Boulevard', localityLeft: 'Burpengary East', localityRight: 'Narangba', path: [[152.99306, -27.15691], [152.99213, -27.15678]] },
    ])
  })

  it('rejects an error response', () => {
    expect(() => parseRoadSegments({ error: { code: 400, message: 'Failed to execute query.' } })).toThrow()
  })
})
