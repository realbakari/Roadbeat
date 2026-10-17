import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS } from '../components/map/settings'
import { searchWithView, viewFromSearch } from './viewUrl'

describe('searchWithView', () => {
  it('leaves an untouched map out of the address', () => {
    expect(searchWithView('', { base: 'map', image: 'infrared', layers: DEFAULT_LAYERS })).toBe('')
  })

  it('writes the base, image and every layer that is on, keeping other parameters', () => {
    const s = searchWithView('?ref=share', { base: 'satellite', image: 'jma-truecolour', layers: { ...DEFAULT_LAYERS, radar: true, webcams: false } })
    expect(s).toContain('ref=share')
    expect(s).toContain('base=satellite')
    expect(s).toContain('image=jma-truecolour')
    const layers = new URLSearchParams(s).get('layers')!.split(',')
    expect(layers).toContain('radar')
    expect(layers).toContain('fires')
    expect(layers).not.toContain('webcams')
  })
})

describe('viewFromSearch', () => {
  it('reads back what was written', () => {
    const view = { base: 'satellite' as const, image: 'terra' as const, layers: { ...DEFAULT_LAYERS, hotspots: true, fires: false } }
    expect(viewFromSearch(searchWithView('', view))).toEqual(view)
  })

  it('drops what it does not know', () => {
    const v = viewFromSearch('?base=globe&image=daily&layers=radar,castles')
    expect(v.base).toBeUndefined()
    expect(v.image).toBeUndefined()
    expect(v.layers?.radar).toBe(true)
    expect(v.layers?.fires).toBe(false)
    expect(Object.keys(v.layers!)).not.toContain('castles')
  })

  it('names nothing for a plain address', () => {
    expect(viewFromSearch('')).toEqual({})
  })
})
