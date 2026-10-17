import { describe, expect, it } from 'vitest'
import { minTextContrast } from '../test/surfaces'
import { classColors, contrastRatio } from './contrast'
import { CLOSURE_BAR, CLOSURE_TEXT, CRASH_BAR, CRASH_TEXT } from './dashboardTones'

describe('dashboard tones', () => {
  it('keeps closure and crash text at 4.5:1 in both modes', () => {
    expect(minTextContrast(CLOSURE_TEXT)).toBeGreaterThanOrEqual(4.5)
    expect(minTextContrast(CRASH_TEXT)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the bars at 3:1 against the dark track', () => {
    for (const bar of [CLOSURE_BAR, CRASH_BAR]) expect(contrastRatio(classColors(bar).dark.bg, '#262626')).toBeGreaterThanOrEqual(3)
  })
})
