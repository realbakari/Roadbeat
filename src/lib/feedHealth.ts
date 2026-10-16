import type { SourceStatus } from '../api/newsTypes'
import type { Feed, ReadPath } from './feedRegistry'

// What one check of a feed observed. Nothing here is inferred: a feed is "ok"
// only when its own fetch function returned parsed data, and "not checked" is
// the state until then, or for feeds the page cannot read.

/** A time the publisher put on the feed itself, and what it means. */
export interface PublisherTime {
  at: number
  /** "Published", "Feeds read", "Measured hour", "Latest reading"… */
  label: string
}

export type FeedOutcome =
  | { kind: 'unchecked'; reason: string }
  | { kind: 'ok'; checkedAt: number; publisherTime: PublisherTime | null; sources: SourceStatus[] | null }
  | { kind: 'failed'; checkedAt: number; error: string; needsProxy: boolean }

export const NOT_YET = 'Not checked yet'

/** What the app's fetch functions say when a static host answers HTML where a proxy should be. */
export function isProxyError(message: string) {
  return /proxy is not configured/i.test(message)
}

export function summarise(outcomes: Iterable<FeedOutcome>) {
  const out = { ok: 0, failed: 0, unchecked: 0 }
  for (const o of outcomes) out[o.kind]++
  return out
}

/** Feeds grouped by publisher, in registry order; the first feed's publisher comes first. */
export function groupByPublisher<F extends Pick<Feed, 'publisher'>>(feeds: readonly F[]): { publisher: string; feeds: F[] }[] {
  const groups = new Map<string, F[]>()
  for (const f of feeds) {
    const list = groups.get(f.publisher)
    if (list) list.push(f)
    else groups.set(f.publisher, [f])
  }
  return [...groups].map(([publisher, feeds]) => ({ publisher, feeds }))
}

/** "15 s", "5 min", "6 h". */
export function cadenceLabel(seconds: number) {
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  return `${Math.round(seconds / 3600)} h`
}

export function readLabel(read: ReadPath, path: string | null) {
  if (read === 'direct') return 'Direct'
  if (read === 'proxy') return `Proxy ${path ?? ''}`.trim()
  return `Server ${path ?? ''}`.trim()
}
