// @vitest-environment jsdom
import type * as maplibregl from 'maplibre-gl'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../../api/types'
import { useFitEvent } from './useFitEvent'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Each poll parses the feed afresh, so the open event comes back as a new object with the same id.
const copy = (id: number) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [153, -27.5] }, properties: { id } }) as unknown as TrafficEvent

function Harness({ map, event }: { map: maplibregl.Map; event: TrafficEvent | null }) {
  useFitEvent(map, event)
  return null
}

describe('useFitEvent', () => {
  it('fits the map once per opened event, not on every refresh', () => {
    let fits = 0
    const map = { fitBounds: () => fits++ } as unknown as maplibregl.Map
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Harness map={map} event={copy(834662)} />))
    act(() => root.render(<Harness map={map} event={copy(834662)} />))
    act(() => root.render(<Harness map={map} event={copy(834662)} />))
    expect(fits).toBe(1)
    act(() => root.render(<Harness map={map} event={copy(757035)} />))
    expect(fits).toBe(2)
    act(() => root.render(<Harness map={map} event={null} />))
    act(() => root.render(<Harness map={map} event={copy(757035)} />))
    expect(fits).toBe(3)
    act(() => root.unmount())
  })
})
