// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { WazeReport } from '../api/types'
import type { MapLayers } from '../components/map/settings'
import type { PlaceSources } from '../lib/places'
import type { Selection } from '../lib/route'
import { useSelectedPlace, type MapFocus } from './useSelection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// The events poll replaces the Waze list every 60 s with freshly parsed, equal reports.
const waze = () => [{ uuid: 'w1', type: 'HAZARD', subtype: '', location: { x: 153, y: -27.5 } } as WazeReport]
const sources = (): PlaceSources => ({ restAreas: [], dumpPoints: [], truckRestrictions: [], waze: waze() }) as unknown as PlaceSources

function Harness({ sel, s, onFocus }: { sel: Selection; s: PlaceSources; onFocus: (f: MapFocus | null) => void }) {
  useSelectedPlace(
    sel,
    s,
    (() => {}) as React.Dispatch<React.SetStateAction<MapLayers>>,
    ((f: MapFocus | null) => onFocus(f)) as React.Dispatch<React.SetStateAction<MapFocus | null>>,
  )
  return null
}

describe('useSelectedPlace', () => {
  it('flies to an open place once, not again on every feed refresh', () => {
    const focuses: (MapFocus | null)[] = []
    const sel = { place: { kind: 'waze', id: 'w1' } } as Selection
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Harness sel={sel} s={sources()} onFocus={(f) => focuses.push(f)} />))
    act(() => root.render(<Harness sel={sel} s={sources()} onFocus={(f) => focuses.push(f)} />))
    act(() => root.render(<Harness sel={sel} s={sources()} onFocus={(f) => focuses.push(f)} />))
    expect(focuses).toEqual([{ center: [153, -27.5], zoom: 13 }])
    act(() => root.unmount())
  })
})
