import { useSyncExternalStore } from 'react'

/** Delay in seconds between a reported and a published time, or null without a report. */
export function delayOf(reported: number | null | undefined, scheduled: number) {
  return reported == null ? null : Math.round((reported - scheduled) / 1000)
}

// How departure times are shown, as in the TransLink app's stop filter: clock times or minutes to go.
export type TimeFormat = 'clock' | 'minutes'
const KEY = 'qldt-time-format'
const listeners = new Set<() => void>()
function readFormat(): TimeFormat {
  try {
    return localStorage.getItem(KEY) === 'minutes' ? 'minutes' : 'clock'
  } catch {
    return 'clock'
  }
}
let format: TimeFormat = readFormat()

export function useTimeFormat(): [TimeFormat, (f: TimeFormat) => void] {
  const value = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => format,
    () => format,
  )
  const set = (f: TimeFormat) => {
    format = f
    try {
      localStorage.setItem(KEY, f)
    } catch {
      // Storage blocked: keep it for this visit.
    }
    listeners.forEach((l) => l())
  }
  return [value, set]
}

/**
 * "Now" or "5 min" until `t`, or null an hour or more away, where (as in the
 * TransLink app) a clock time reads better than a long countdown.
 */
export function minutesUntil(t: number, now: number): string | null {
  const m = Math.round((t - now) / 60_000)
  if (m <= 0) return 'Now'
  return m < 60 ? `${m} min` : null
}
