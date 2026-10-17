// @vitest-environment jsdom
import type * as maplibregl from 'maplibre-gl'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { LiveVehicle } from '../../api/translink'
import { useAnimatedVehicles } from './useAnimatedVehicles'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Reduced motion: the glide is skipped, so the hook is "done" straight away, as on a phone with that setting.
window.matchMedia = (query: string) =>
  ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList

/** A map whose jumpTo fires 'moveend' synchronously, as MapLibre's Camera.jumpTo does. */
function mockMap() {
  const listeners = new Map<string, Set<() => void>>()
  let jumps = 0
  const fire = (type: string) => listeners.get(type)?.forEach((l) => l())
  const bounds = { getWest: () => 152, getEast: () => 154, getSouth: () => -28, getNorth: () => -27 }
  const map = {
    getBounds: () => bounds,
    getZoom: () => 12,
    getSource: () => ({ setData() {} }),
    jumpTo() {
      jumps++
      fire('moveend')
    },
    on(type: string, l: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(l)
    },
    off(type: string, l: () => void) {
      listeners.get(type)?.delete(l)
    },
  }
  return { map: map as unknown as maplibregl.Map, fire, jumps: () => jumps }
}

const bus = {
  id: 'a',
  mode: 'bus',
  route: '402',
  lineName: null,
  routeName: null,
  position: [153, -27.5],
} as unknown as LiveVehicle

function Harness({ map }: { map: maplibregl.Map }) {
  useAnimatedVehicles(map, 1, [bus], 'a')
  return null
}

describe('useAnimatedVehicles', () => {
  it('follows a vehicle through a zoom without re-entering on its own jump', () => {
    const { map, fire, jumps } = mockMap()
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Harness map={map} />))
    const before = jumps()
    expect(() => fire('moveend')).not.toThrow()
    expect(jumps() - before).toBe(1)
    act(() => root.unmount())
  })
})
