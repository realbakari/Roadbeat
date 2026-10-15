import { describe, expect, it } from 'vitest'
import type { RoadSegment } from '../api/qldRoads'
import { gazetteerPlace, newsItem } from '../test/fixtures'
import { roadBounds, roadNames, roadQuestion, roadsInLocalities } from './newsRoads'

describe('roadNames', () => {
  it('finds road names and spells abbreviations as the roads dataset does', () => {
    expect(roadNames('A black Suzuki was travelling north along Avaline Boulevard when it lost control')).toEqual(['Avaline Boulevard'])
    expect(roadNames('Crash closes the Bruce Hwy at Gympie; delays on Mount Byron Rd')).toEqual(['Bruce Highway', 'Mount Byron Road'])
  })

  it('keeps names that start with words such as "Old", and drops leading words such as "The"', () => {
    expect(roadNames('Old Gympie Road reopened. The Warrego Highway is closed.')).toEqual(['Old Gympie Road', 'Warrego Highway'])
  })

  it('needs a capitalised name before the type, and lists each road once', () => {
    expect(roadNames('down the road and across the street, then Queen Street and Queen Street again')).toEqual(['Queen Street'])
  })
})

describe('roadQuestion', () => {
  it('asks only when the text names both a road and a gazetteer locality', () => {
    const place = gazetteerPlace('Burpengary East', 'Moreton Bay')
    expect(roadQuestion(newsItem({ title: 'Crash, Burpengary East', summary: 'A motorbike crashed on Avaline Boulevard.', places: [place] }))).toEqual({
      names: ['Avaline Boulevard'],
      localities: [{ name: 'Burpengary East', lga: 'Moreton Bay' }],
    })
    expect(roadQuestion(newsItem({ title: 'Bruce Highway closed', places: [] }))).toBeNull()
    expect(roadQuestion(newsItem({ title: 'Crash, Burpengary East', places: [place] }))).toBeNull()
  })
})

describe('roadsInLocalities', () => {
  const segment = (road: string, left: string, right: string, x: number): RoadSegment => ({ road, localityLeft: left, localityRight: right, path: [[x, 0], [x + 1, 1]] })
  const burpengaryEast = { name: 'Burpengary East', lga: 'Moreton Bay' }

  it('keeps segments of each named road with the named locality on either side', () => {
    const roads = roadsInLocalities(['Avaline Boulevard'], [burpengaryEast], [
      segment('Avaline Boulevard', 'Burpengary East', 'Burpengary East', 0),
      segment('Avaline Boulevard', 'Narangba', 'Burpengary East', 2),
      segment('Avaline Boulevard', 'Narangba', 'Narangba', 4),
      segment('Other Road', 'Burpengary East', 'Burpengary East', 6),
    ])
    expect(roads).toEqual([{ name: 'Avaline Boulevard', locality: 'Burpengary East', lga: 'Moreton Bay', lines: [[[0, 0], [1, 1]], [[2, 0], [3, 1]]] }])
  })

  it('places a road crossing two named localities in one council area, but not a name found in two council areas', () => {
    const narangba = { name: 'Narangba', lga: 'Moreton Bay' }
    const beenleigh = { name: 'Beenleigh', lga: 'Logan City' }
    const segments = [segment('Main Street', 'Burpengary East', 'Burpengary East', 0), segment('Main Street', 'Narangba', 'Narangba', 2)]
    expect(roadsInLocalities(['Main Street'], [burpengaryEast, narangba], segments).map((r) => r.locality)).toEqual(['Burpengary East', 'Narangba'])
    expect(roadsInLocalities(['Main Street'], [burpengaryEast, beenleigh], [...segments, segment('Main Street', 'Beenleigh', 'Beenleigh', 4)])).toEqual([])
  })

  it('places nothing when the road has no segment in a named locality', () => {
    expect(roadsInLocalities(['Bruce Highway'], [burpengaryEast], [segment('Bruce Highway', 'Gympie', 'Gympie', 0)])).toEqual([])
  })

  it('bounds a road by its published segments', () => {
    expect(roadBounds({ name: 'X Road', locality: 'Y', lga: null, lines: [[[1, -2], [3, -1]], [[0, -4], [2, -3]]] })).toEqual([[0, -4], [3, -1]])
  })
})
