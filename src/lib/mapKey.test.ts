import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS, type MapLayers } from '../components/map/settings'
import { iconUrl } from './mapIcons'
import { mapKeySections } from './mapKey'

const empty = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('')}`

describe('mapKeySections', () => {
  it('always lists road events, and only the layers that are on', () => {
    const titles = mapKeySections(DEFAULT_LAYERS).map((s) => s.title)
    expect(titles[0]).toBe('Road events (QLDTraffic)')
    expect(titles).toContain('Bushfires (QFD)')
    expect(titles).not.toContain('Truck restrictions')
    const all = mapKeySections({ ...DEFAULT_LAYERS, trucks: true, waze: true, restAreas: true, hotspots: true, cyclones: true })
    expect(all.map((s) => s.title)).toEqual(expect.arrayContaining(['Truck restrictions', 'Waze user reports', 'Places', 'Tropical cyclones (JTWC, not the official warning)']))
  })

  it('names only map icons that exist, so the key never shows a blank', () => {
    const allOn: MapLayers = { ...DEFAULT_LAYERS }
    for (const k of Object.keys(allOn) as (keyof MapLayers)[]) allOn[k] = true
    const every = mapKeySections(allOn)
    const icons = every.flatMap((s) => s.items.flatMap((i) => ('icon' in i ? [i.icon] : [])))
    expect(icons.length).toBeGreaterThan(15)
    for (const id of icons) expect(iconUrl(id), id).not.toBe(empty)
  })
})
