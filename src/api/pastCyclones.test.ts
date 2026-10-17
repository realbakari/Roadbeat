import { describe, expect, it } from 'vitest'
import { parsePastCyclones, pastCycloneTitle } from './pastCyclones'

describe('parsePastCyclones', () => {
  it('reads the built file into tracks with real times', () => {
    const [yasi] = parsePastCyclones({
      storms: [{ id: '2011028S13180', name: 'Yasi', season: 2011, agency: 'bom', peakKt: 110, points: [[146.0, -17.7, 1296568800, 110], [145.2, -18.0, 1296590400, null]] }],
    })
    expect(yasi.points).toEqual([
      { position: [146, -17.7], at: 1296568800000, windKt: 110 },
      { position: [145.2, -18], at: 1296590400000, windKt: null },
    ])
    expect(pastCycloneTitle(yasi)).toBe('Yasi (2011)')
    expect(pastCycloneTitle({ ...yasi, name: null })).toBe('Unnamed cyclone (2011)')
  })

  it('gives nothing for a file in another shape', () => {
    expect(parsePastCyclones({})).toEqual([])
  })
})
