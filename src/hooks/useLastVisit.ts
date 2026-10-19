import { useEffect, useMemo, useState } from 'react'
import type { TrafficEvent } from '../api/types'
import { newSince, parseVisit, visitOf, type Visit } from '../lib/lastVisit'

const KEY = 'qldt-last-visit'

function readVisit(): Visit | null {
  try {
    return parseVisit(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return null
  }
}

/**
 * The road events new since this browser's last visit, and when that was.
 * The earlier visit is read once, when the app opens, so the marks stay put
 * while it's open; each read of the feed is then stored for the next visit.
 */
export function useLastVisit(events: TrafficEvent[], fetchedAt: number | null): { newIds: Set<number>; since: number | null } {
  const [previous] = useState(readVisit)
  useEffect(() => {
    if (fetchedAt == null || !events.length) return
    try {
      localStorage.setItem(KEY, JSON.stringify(visitOf(events, fetchedAt)))
    } catch {
      // Storage unavailable: nothing is marked new next time.
    }
  }, [events, fetchedAt])
  const newIds = useMemo(() => (fetchedAt == null ? new Set<number>() : newSince(previous, events)), [previous, events, fetchedAt])
  return { newIds, since: previous?.at ?? null }
}
