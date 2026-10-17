import { classColors, contrastRatio } from '../lib/contrast'

// Kumo's surfaces: white and neutral-100 in light mode; neutral 10% to 26.9% in dark mode.
const LIGHT_SURFACES = ['#ffffff', '#f5f5f5']
const DARK_SURFACES = ['#030303', '#0f0f0f', '#262626']

/** The lowest contrast a `text-[#…] dark:text-[#…]` class list gets on any Kumo surface in its mode. */
export function minTextContrast(classes: string) {
  const { light, dark } = classColors(classes)
  return Math.min(...LIGHT_SURFACES.map((s) => contrastRatio(light.text, s)), ...DARK_SURFACES.map((s) => contrastRatio(dark.text, s)))
}
