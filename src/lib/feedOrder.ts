import { brisbaneDate, brisbaneDayKey } from './aest'
import type { Post } from './posts'

// Keeps the timeline still while someone reads it. Once they scroll away from
// the top, the posts on screen keep their order (their content still updates),
// and posts that are new or newly updated wait behind a "new posts" button
// instead of pushing the list around.

/** The order the reader is looking at: each post's id and its latest activity then. */
export type FeedSnapshot = { id: string; latest: number }[]

export const snapshotOf = (posts: Post[]): FeedSnapshot => posts.map((p) => ({ id: p.id, latest: p.latest }))

/**
 * The posts in the snapshot's order, as they are now, and how many posts are
 * new or have newer activity than when the snapshot was taken. A post its
 * publisher has stopped listing drops out, since nothing published shows it.
 */
export function holdOrder(snapshot: FeedSnapshot, current: Post[]): { posts: Post[]; waiting: number } {
  const byId = new Map(current.map((p) => [p.id, p]))
  const seen = new Map(snapshot.map((s) => [s.id, s.latest]))
  const posts = snapshot.flatMap((s) => {
    const p = byId.get(s.id)
    return p ? [p] : []
  })
  const waiting = current.filter((p) => !seen.has(p.id) || p.latest > (seen.get(p.id) ?? 0)).length
  return { posts, waiting }
}

const short = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short' })

/** A day marker's words for an instant, in Queensland time: "Today", "Yesterday" or "Mon 19 Oct". */
export function dayLabel(t: number, now: number): string {
  const day = brisbaneDate(t)
  if (day === brisbaneDate(now)) return 'Today'
  if (day === brisbaneDate(now - 86_400_000)) return 'Yesterday'
  return short.format(t).replace(',', '')
}

/** The Queensland day an instant falls on, as a key to compare. */
export const dayKey = (t: number) => brisbaneDayKey.format(t)
