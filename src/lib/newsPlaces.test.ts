import { describe, expect, it } from 'vitest'
import { locate, placeIndex, type GazetteerRow } from './newsPlaces'

const rows: GazetteerRow[] = [
  ['Brisbane', 153.02, -27.47, 'Brisbane City'],
  ['Toowoomba', 151.95, -27.56, 'Toowoomba Regional'],
  ['Burpengary', 152.96, -27.16, 'Moreton Bay'],
  ['Burpengary East', 153.0, -27.15, 'Moreton Bay'],
  ['Gold Coast', 153.4, -28.0, 'Gold Coast City'],
  ['Cairns', 145.77, -16.92, 'Cairns Regional'],
  ['Kippa-Ring', 153.08, -27.22, 'Moreton Bay'],
]
const index = placeIndex(rows)
const names = (text: string) => locate(text, index).map((p) => p.name)

describe('locate', () => {
  it('matches whole place names exactly, longest first', () => {
    expect(names('Serious traffic crash charges, Burpengary East')).toEqual(['Burpengary East'])
    expect(names('Crash at Burpengary and Kippa-Ring')).toEqual(['Burpengary', 'Kippa-Ring'])
  })

  it('reports where it located from, with the council area and the gazetteer point', () => {
    expect(locate("Toowoomba's mayor", index)).toEqual([{ name: 'Toowoomba', lga: 'Toowoomba Regional', position: [151.95, -27.56], via: 'gazetteer' }])
  })

  it('lists each place once, in the order named', () => {
    expect(names('Brisbane to Toowoomba, then back to Brisbane')).toEqual(['Brisbane', 'Toowoomba'])
  })

  it('matches "-based" and possessives but not other words that contain a name', () => {
    expect(names('A Cairns-based pilot')).toEqual(['Cairns'])
    expect(names('Brisbanes and toowoomba')).toEqual([])
  })

  it('ignores mastheads and team names', () => {
    expect(names('Brisbane Broncos beat Gold Coast Titans, Brisbane Times reports')).toEqual([])
  })

  it('reads a council name as its town, not a suburb named "City"', () => {
    const withCity = placeIndex([...rows, ['Brisbane City', 153.03, -27.47, 'Brisbane City']])
    expect(locate('Brisbane City Council floats CityCat bars', withCity).map((p) => p.name)).toEqual(['Brisbane'])
  })

  it("doesn't join names across punctuation", () => {
    expect(names('Burpengary, East Timor')).toEqual(['Burpengary'])
  })

  it('finds nothing when no place is named', () => {
    expect(names('Interest rates on hold')).toEqual([])
  })
})
