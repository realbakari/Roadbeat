// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { SatelliteSuggestion } from './SatelliteSuggestion'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('SatelliteSuggestion', () => {
  it('shows the prompt and reports Show satellite and Dismiss', () => {
    const el = document.createElement('div')
    const onShow = vi.fn()
    const onDismiss = vi.fn()
    const root = createRoot(el)
    act(() => root.render(<SatelliteSuggestion suggestion={{ key: 'cyclone:03P', text: 'Cyclone Alfred near Australia (JTWC): show the live satellite view?' }} onShow={onShow} onDismiss={onDismiss} />))
    expect(el.textContent).toContain('Cyclone Alfred near Australia (JTWC)')
    act(() => [...el.querySelectorAll('button')].find((b) => b.textContent === 'Show satellite')!.click())
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!.click())
    expect(onShow).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
    act(() => root.unmount())
  })
})
