// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyThemeColor, themeColorFor } from './themeColor'

const tags = [
  { media: '(prefers-color-scheme: light)', content: '#ffffff' },
  { media: '(prefers-color-scheme: dark)', content: '#0f0f0f' },
]

describe('themeColorFor', () => {
  it("picks the colour shipped for the chosen mode, whatever the system's", () => {
    expect(themeColorFor(tags, 'dark')).toBe('#0f0f0f')
    expect(themeColorFor(tags, 'light')).toBe('#ffffff')
  })

  it('gives null when the page has no tag for that mode', () => {
    expect(themeColorFor([{ media: null, content: '#7a1f3d' }], 'dark')).toBeNull()
  })
})

describe('applyThemeColor', () => {
  afterEach(() => (document.head.innerHTML = ''))

  it('sets both tags to the chosen mode and can switch back', () => {
    document.head.innerHTML = tags.map((t) => `<meta name="theme-color" media="${t.media}" content="${t.content}">`).join('')
    const contents = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content)
    applyThemeColor('dark')
    expect(contents()).toEqual(['#0f0f0f', '#0f0f0f'])
    applyThemeColor('light')
    expect(contents()).toEqual(['#ffffff', '#ffffff'])
  })
})
