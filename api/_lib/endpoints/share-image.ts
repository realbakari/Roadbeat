import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { ImageResponse } from '@vercel/og'
import { createElement as h, type CSSProperties, type ReactNode } from 'react'
import { z } from 'zod'
import type { ShareCard } from '../../../src/lib/shareCard.js'
import { query } from '../http.js'
import { CARD_SOURCES, findCard } from '../shareCards.js'

// GET /api/share-image?source=<source>&id=<id>: a timeline post's 1200 × 630
// card for link previews, drawn like the timeline: the publisher's lane down
// the left with its node, the publisher, its own words, its time in Queensland
// time and its licence credit. Inter is under the SIL Open Font Licence.

const Query = z.object({ source: z.enum(CARD_SOURCES), id: z.string().min(1).max(200) })

// Each path is written out, so Vercel's file tracing bundles the fonts with the function (vercel.json lists them too).
const require = createRequire(import.meta.url)
const FONT_FILES = {
  400: require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
  600: require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff'),
  700: require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
} as const
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[]> | null = null
const loadFonts = () =>
  (fonts ??= Promise.all(([400, 600, 700] as const).map(async (weight) => ({ name: 'Inter', data: await readFile(FONT_FILES[weight]), weight, style: 'normal' as const }))))

const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = '#e2e8f0'

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`)

const box = (style: CSSProperties, ...children: ReactNode[]) => h('div', { style: { display: 'flex', ...style } }, ...children)

function card(c: ShareCard) {
  const initial = c.publisher.trim()[0]?.toUpperCase() ?? 'R'
  return box(
    { width: 1200, height: 630, backgroundColor: '#ffffff', fontFamily: 'Inter', color: INK, position: 'relative' },
    // The rail: the lane from the node down to a dot, as on the timeline.
    box(
      { width: 168, height: 630, position: 'relative', justifyContent: 'center' },
      box({ position: 'absolute', top: 150, bottom: 96, left: 82, width: 4, backgroundColor: c.lane, borderRadius: 2 }),
      box(
        { position: 'absolute', top: 64, left: 36, width: 96, height: 96, borderRadius: 48, border: `4px solid ${c.lane}`, backgroundColor: '#ffffff', padding: 5 },
        box({ width: '100%', height: '100%', borderRadius: 40, backgroundColor: c.lane, color: '#ffffff', fontSize: 40, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }, initial),
      ),
      box({ position: 'absolute', bottom: 84, left: 74, width: 20, height: 20, borderRadius: 10, backgroundColor: c.lane, border: '4px solid #ffffff', boxShadow: `0 0 0 3px ${c.lane}` }),
    ),
    box(
      { flexDirection: 'column', flex: 1, paddingTop: 66, paddingRight: 72, paddingBottom: 56, minWidth: 0 },
      box(
        { alignItems: 'baseline', gap: 16 },
        box({ fontSize: 40, fontWeight: 700, whiteSpace: 'nowrap' }, clip(c.publisher, 32)),
        box({ marginLeft: 'auto', fontSize: 24, fontWeight: 600, color: MUTED, whiteSpace: 'nowrap' }, 'roadbeat.app'),
      ),
      box(
        { alignItems: 'center', gap: 14, marginTop: 10, fontSize: 26, color: MUTED, whiteSpace: 'nowrap' },
        box({}, clip([c.handle, c.kind].filter(Boolean).join(' · '), 56)),
        c.level ? box({ backgroundColor: c.level.color, color: '#ffffff', fontWeight: 600, borderRadius: 999, padding: '4px 16px', fontSize: 24 }, c.level.text) : null,
      ),
      box({ marginTop: 34, fontSize: c.title.length > 40 ? 52 : 62, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }, clip(c.title, 80)),
      c.description ? box({ marginTop: 18, fontSize: 32, lineHeight: 1.4, color: '#334155' }, clip(c.description, 150)) : null,
      box(
        { marginTop: 'auto', flexDirection: 'column', gap: 8, borderTop: `2px solid ${LINE}`, paddingTop: 22 },
        box({ fontSize: 26, color: INK }, clip([c.place, c.when].filter(Boolean).join(' · ') || 'Roadbeat timeline', 78)),
        box({ fontSize: 22, color: MUTED }, clip(`Source: ${c.credit}`, 90)),
      ),
    ),
  )
}

export async function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  const [c, fontData] = await Promise.all([findCard(q.source, q.id), loadFonts()])
  return new ImageResponse(card(c), {
    width: 1200,
    height: 630,
    fonts: fontData,
    headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
