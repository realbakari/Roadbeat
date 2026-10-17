import type { ColorMode } from '../hooks/useColorMode'

/** One <meta name="theme-color"> tag: the scheme it was written for, and its colour. */
export interface ThemeColorTag {
  media: string | null
  content: string
}

/**
 * The colour every theme-color tag should carry for the app's chosen mode.
 * The page ships one tag for a light system setting and one for dark; the
 * in-app toggle can differ from the system, so both tags take the chosen
 * mode's colour. Null when the page has no tag for that mode.
 */
export function themeColorFor(tags: ThemeColorTag[], mode: ColorMode): string | null {
  return tags.find((t) => t.media?.includes(`prefers-color-scheme: ${mode}`))?.content ?? null
}

/** Sets the browser toolbar colour to match the app's chosen mode. */
export function applyThemeColor(mode: ColorMode) {
  const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
  // The colours as the page shipped them, kept on the tag so later toggles can read them back.
  for (const m of metas) m.dataset.shipped ??= m.content
  const color = themeColorFor(
    metas.map((m) => ({ media: m.getAttribute('media'), content: m.dataset.shipped! })),
    mode,
  )
  if (color) for (const m of metas) m.content = color
}
