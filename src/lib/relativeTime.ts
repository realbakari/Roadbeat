import { brisbaneDayDateTime } from './aest'
import { timeAgo } from './format'

// What a "3 hours ago" says in full: the instant for <time datetime>, the
// exact Brisbane time to check it against, and the sentence a screen reader
// hears. A relative time alone can't be checked, and Roadbeat shows when each
// source published, so the exact time is always one hover, focus or tap away.

export interface TimeDetail {
  /** "3 hours ago" */
  label: string
  /** The instant, for <time datetime>. */
  iso: string
  /** "Sat, 17 Oct, 4:05 pm AEST" */
  exact: string
  /** "3 hours ago, Sat, 17 Oct, 4:05 pm AEST" */
  spoken: string
}

/** The parts of a relative time, or null for a missing or unreadable one. */
export function timeDetail(at: string | number | null | undefined, now: number): TimeDetail | null {
  if (at == null) return null
  const t = typeof at === 'number' ? at : new Date(at).getTime()
  const label = timeAgo(t, now)
  if (!label || !Number.isFinite(t)) return null
  const exact = `${brisbaneDayDateTime.format(t)} AEST`
  return { label, iso: new Date(t).toISOString(), exact, spoken: `${label}, ${exact}` }
}
