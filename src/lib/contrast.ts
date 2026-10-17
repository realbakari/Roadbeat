/** WCAG relative luminance of a #rrggbb colour, or null if it isn't one. */
export function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 to 21. NaN if either isn't a colour. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  if (la == null || lb == null) return NaN
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * The light-mode and dark-mode hex colours in a class list such as
 * `text-[#b91c1c] dark:text-[#f87171]`, keyed by utility (`text`, `bg`).
 */
export function classColors(classes: string): { light: Record<string, string>; dark: Record<string, string> } {
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  for (const m of classes.matchAll(/(dark:)?(text|bg)-\[(#[0-9a-f]{6})\]/gi)) (m[1] ? dark : light)[m[2]] = m[3]
  return { light, dark }
}
