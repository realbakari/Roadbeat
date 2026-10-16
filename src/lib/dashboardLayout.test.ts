import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, initialLayout, layoutQuery, movePanel, panelsOf, parseLayout, storedLayout, togglePanel, type PanelId } from './dashboardLayout'

const storage = (value: string | null) => ({ getItem: () => value })

describe('parseLayout and layoutQuery', () => {
  it('reads a layout from the link, dropping unknown ids and repeats', () => {
    expect(parseLayout('?show=news,fires,bogus,news')).toEqual(['news', 'fires'])
    expect(parseLayout('?show=')).toEqual([])
    expect(parseLayout('?other=1')).toBeNull()
  })

  it('writes a link only for a layout that differs from the default', () => {
    expect(layoutQuery(DEFAULT_LAYOUT)).toBe('')
    expect(layoutQuery(['news', 'air'])).toBe('?show=news,air')
  })
})

describe('initialLayout', () => {
  it('prefers the link, then this browser, then the default', () => {
    expect(initialLayout('?show=air', storage('["news"]'))).toEqual(['air'])
    expect(initialLayout('', storage('["news","bogus"]'))).toEqual(['news'])
    expect(initialLayout('', storage('not json'))).toEqual(DEFAULT_LAYOUT)
    expect(storedLayout(storage(null))).toBeNull()
  })
})

describe('togglePanel and movePanel', () => {
  const layout: PanelId[] = ['events', 'news', 'districts', 'fires']

  it("shows a hidden panel in the registry's order, and hides a shown one", () => {
    expect(togglePanel(layout, 'transit')).toEqual(['events', 'news', 'districts', 'transit', 'fires'])
    expect(togglePanel(layout, 'news')).toEqual(['events', 'districts', 'fires'])
  })

  it('moves a panel among the shown panels of its kind only', () => {
    expect(movePanel(layout, 'fires', -1)).toEqual(['events', 'news', 'fires', 'districts'])
    expect(movePanel(layout, 'districts', -1)).toEqual(layout)
    expect(movePanel(layout, 'news', 1)).toEqual(layout)
    expect(panelsOf(layout, 'tile')).toEqual(['districts', 'fires'])
  })
})
