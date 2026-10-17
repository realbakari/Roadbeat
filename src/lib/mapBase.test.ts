import { describe, expect, it } from 'vitest'
import { parseBase, parseSatelliteSource } from './mapBase'

describe('parseBase', () => {
  it('accepts only the two bases', () => {
    expect(parseBase('satellite')).toBe('satellite')
    expect(parseBase('map')).toBe('map')
    expect(parseBase('radar')).toBeNull()
    expect(parseBase(null)).toBeNull()
  })
})

describe('parseSatelliteSource', () => {
  it('accepts only an image the layer offers', () => {
    expect(parseSatelliteSource('jma-truecolour')).toBe('jma-truecolour')
    expect(parseSatelliteSource('terra')).toBe('terra')
    expect(parseSatelliteSource('daily')).toBeNull()
  })
})
