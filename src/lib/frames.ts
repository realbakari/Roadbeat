// Satellite frames for the timeline: only times the publisher lists, each
// with its own time, never one in between. Times are ISO UTC strings
// ("2026-10-17T13:10:00Z"), which sort in time order as text.

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const asTime = (s: string) => (ISO_TIME.test(s) ? s : DATE.test(s) ? `${s}T00:00:00Z` : null)
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')

/**
 * Every time a GIBS DescribeDomains document lists. Its time domain is a
 * comma-separated list of "start/end/PT10M" ranges (or single times), each a
 * run of images GIBS publishes at that step; the breaks between ranges are
 * times it has no image for, so nothing is added there.
 */
export function domainFrames(xml: string): string[] {
  const domain = /<Domain>([^<]*)<\/Domain>/.exec(xml)?.[1].trim()
  if (!domain) return []
  const out: string[] = []
  for (const part of domain.split(',')) {
    const [a, b, period] = part.trim().split('/')
    const start = asTime(a)
    if (!start) continue
    const end = b ? asTime(b) : start
    const step = /^PT(\d+)M$/.exec(period ?? '')
    if (!end || !step) {
      out.push(start)
      continue
    }
    const ms = Number(step[1]) * 60_000
    for (let t = Date.parse(start); t <= Date.parse(end); t += ms) out.push(iso(t))
  }
  return [...new Set(out)].sort()
}

/** Two reads' frames together, oldest first: GIBS's servers don't all list the newest image at once, and every listed one was published. */
export function mergeFrames(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort()
}

/** The frames in the `hours` before the newest one, oldest first. */
export function recentFrames(frames: readonly string[], hours: number): string[] {
  const newest = frames.at(-1)
  if (!newest) return []
  const from = Date.parse(newest) - hours * 3_600_000
  return frames.filter((t) => Date.parse(t) >= from)
}

/** The frame `delta` steps from `current` (null is the newest), wrapping round so play loops. */
export function stepFrame(frames: readonly string[], current: string | null, delta: number): string | null {
  if (!frames.length) return null
  const i = current == null ? frames.length - 1 : frames.indexOf(current)
  const at = i < 0 ? frames.length - 1 : i
  return frames[(((at + delta) % frames.length) + frames.length) % frames.length]
}
