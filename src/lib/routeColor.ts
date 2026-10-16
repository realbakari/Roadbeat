/**
 * Text colour that stays readable on a route's official colour. TransLink's
 * palette includes light colours (T5 and the G:link are #FFC425) where white
 * text fails contrast, so this picks near-black for light backgrounds.
 * Uses the WCAG relative-luminance formula.
 */
export function readableTextOn(hex: string): '#ffffff' | '#1d1d1d' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const lum = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  const l = lum((n >> 16) & 255, (n >> 8) & 255, n & 255)
  const dark = lum(0x1d, 0x1d, 0x1d)
  // Whichever text colour gives the higher WCAG contrast ratio against the background.
  const onWhite = 1.05 / (l + 0.05)
  const onDark = (l + 0.05) / (dark + 0.05)
  return onDark > onWhite ? '#1d1d1d' : '#ffffff'
}
