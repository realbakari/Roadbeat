import { z } from 'zod'

// Himawari-9's full-disk image from the Japan Meteorological Agency's own
// weather map, every 10 minutes and a few minutes after it is taken. The time
// list and tiles answer CORS requests and need no key. These are the files
// behind JMA's map (bosai/), not a documented API, so JMA can move them
// without notice; NASA GIBS's Himawari-9 image stays the default. The tiles
// stop at zoom 5 (z6 answers 404) and start at zoom 3 (z2 answers 404).
// JMA Public Data License 1.0, compatible with CC BY 4.0: the source must be
// cited.

const BASE = 'https://www.jma.go.jp/bosai/himawari/data/satimg'
export const JMA_TIMES_URL = `${BASE}/targetTimes_fd.json`
export const JMA_CREDIT = 'Source: Japan Meteorological Agency website (https://www.jma.go.jp/)'
export const JMA_MIN_ZOOM = 3
export const JMA_MAX_ZOOM = 5

export type JmaProduct = 'infrared' | 'truecolour'

/** JMA's band and product folders: Band 13 brightness temperature, and its true-colour reproduction. */
const PRODUCT: Record<JmaProduct, string> = { infrared: 'B13/TBB', truecolour: 'REP/ETC' }

/** One image JMA lists: its folder names (UTC, yyyymmddhhmmss) and the image time as ISO UTC. */
export interface JmaFrame {
  basetime: string
  validtime: string
  time: string
}

const Stamp = z.string().regex(/^\d{14}$/)
const Times = z.array(z.object({ basetime: Stamp, validtime: Stamp }))

/** "20261017135000" → "2026-10-17T13:50:00Z". */
export function stampToIso(s: string): string {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`
}

/** The images targetTimes_fd.json lists, oldest first, each named by its own valid time. */
export function parseJmaTimes(json: unknown): JmaFrame[] {
  return Times.parse(json)
    .map((t) => ({ ...t, time: stampToIso(t.validtime) }))
    .filter((f) => Number.isFinite(Date.parse(f.time)))
    .sort((a, b) => a.validtime.localeCompare(b.validtime))
}

/** The tile address template for one listed image, for a MapLibre raster source (x before y, unlike GIBS). */
export function jmaTiles(product: JmaProduct, frame: Pick<JmaFrame, 'basetime' | 'validtime'>): string {
  return `${BASE}/${frame.basetime}/fd/${frame.validtime}/${PRODUCT[product]}/{z}/{x}/{y}.jpg`
}

/** Every image JMA lists now, oldest first (about a day and a half, every 10 minutes). */
export async function fetchJmaFrames(signal?: AbortSignal): Promise<JmaFrame[]> {
  const res = await fetch(JMA_TIMES_URL, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Japan Meteorological Agency responded with ${res.status}`)
  return parseJmaTimes(await res.json())
}
