import { describe, expect, it } from 'vitest'
import { FIRE_BADGE, FIRE_COLOR, FIRE_LEVELS, FIRE_TEXT } from '../api/bushfires'
import { minTextContrast } from '../test/surfaces'
import { classColors, contrastRatio } from './contrast'

describe('contrastRatio', () => {
  it('matches the WCAG extremes and is symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
    expect(contrastRatio('#ff7900', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#ff7900'))
  })

  it('is NaN for something that is not a colour', () => {
    expect(contrastRatio('red', '#ffffff')).toBeNaN()
  })
})

describe('classColors', () => {
  it('splits light and dark colours by utility', () => {
    expect(classColors('bg-[#d6001c] text-[#ffffff] dark:text-[#f87171]')).toEqual({
      light: { bg: '#d6001c', text: '#ffffff' },
      dark: { text: '#f87171' },
    })
  })
})

describe('fire level colours', () => {
  for (const level of FIRE_LEVELS) {
    it(`${level} text reaches 4.5:1 on every surface`, () => {
      expect(minTextContrast(FIRE_TEXT[level])).toBeGreaterThanOrEqual(4.5)
    })

    it(`${level} badge keeps the warning colour with 4.5:1 text`, () => {
      const { light } = classColors(FIRE_BADGE[level])
      expect(light.bg).toBe(FIRE_COLOR[level])
      expect(contrastRatio(light.bg, light.text)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
