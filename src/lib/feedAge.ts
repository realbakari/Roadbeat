/** A feed polled every 30 s is overdue once its last good read is older than this. */
export const STALE_AFTER_MS = 90_000

/**
 * Whether a polled feed's data can no longer be shown as current: its last
 * read failed, or it hasn't answered for longer than STALE_AFTER_MS.
 * False before the first good read, when there's nothing on screen to warn about.
 */
export function isStale(fetchedAt: number | null, failing: boolean, now: number): boolean {
  if (fetchedAt == null) return false
  return failing || now - fetchedAt > STALE_AFTER_MS
}

/**
 * What a live region says about the road events feed. It changes only when the
 * feed fails or recovers, never as "updated n minutes ago" ticks over, so screen
 * readers aren't interrupted every minute.
 */
export function feedAnnouncement(error: string | null, fetchedAt: number | null): string {
  return error ? 'Road events delayed' : fetchedAt != null ? 'Road events live' : ''
}
