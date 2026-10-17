import { describe, expect, it } from 'vitest'
import { pickTap, pickTop, tapBox, tapTolerance, type TapFeature } from './mapPick'

const EVENTS = ['event-markers', 'event-lines', 'event-areas']
const f = (id: string, type: string, properties: Record<string, unknown>): TapFeature => ({ layer: { id, type }, properties })

describe('pickTap', () => {
  it('opens a closure marker inside a bushfire warning area, not the warning', () => {
    const under = [f('outages-area', 'fill', { key: 'place/outage/1' }), f('event-markers', 'symbol', { id: 42 }), f('fire-areas', 'fill', { key: 'fire/9' })]
    expect(pickTap(under, EVENTS)).toEqual({ kind: 'event', id: 42 })
  })

  it("opens the marker drawn on top, not the event whose line it sits on", () => {
    expect(pickTap([f('event-markers', 'symbol', { id: 1 }), f('event-lines', 'line', { id: 2 })], EVENTS)).toEqual({ kind: 'event', id: 1 })
  })

  it('takes the topmost of two markers, and an area when nothing else is there', () => {
    expect(pickTap([f('vehicles', 'symbol', { key: 'vehicle/a' }), f('stops-bus', 'circle', { key: 'stop/b' })], EVENTS)).toEqual({ kind: 'key', key: 'vehicle/a' })
    expect(pickTap([f('fire-areas', 'fill', { key: 'fire/9' })], EVENTS)).toEqual({ kind: 'key', key: 'fire/9' })
  })

  it('ignores features with nothing to open', () => {
    expect(pickTap([f('gauges', 'circle', {})], EVENTS)).toBeNull()
  })
})

describe('pickTop', () => {
  it('shows the hover label of the same feature a tap would open', () => {
    const under = [f('fire-areas', 'fill', { label: 'Watch and Act' }), f('gauges', 'circle', { label: 'Oxley Ck' })]
    expect(pickTop(under)?.properties?.label).toBe('Oxley Ck')
  })
})

describe('tapBox', () => {
  it('centres the query box on the tap', () => {
    expect(tapBox(100, 50, 16)).toEqual([
      [84, 34],
      [116, 66],
    ])
  })

  it('gives fingers a wider box than a mouse', () => {
    expect(tapTolerance(true)).toBeGreaterThan(tapTolerance(false))
  })
})
