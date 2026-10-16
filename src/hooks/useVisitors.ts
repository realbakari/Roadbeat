import { useEffect, useState } from 'react'
import { fetchVisitors, pingVisit, type Visitors } from '../api/visits'

/** Matches the server's 5-minute window, so an open tab stays counted as online. */
const PING_MS = 5 * 60_000

/**
 * Keeps this browser counted while the app is open and reads the current
 * counts. Pings go only while the tab is visible, so a background tab stops
 * counting as online within ten minutes.
 */
export function useVisitors(): Visitors | null {
  const [visitors, setVisitors] = useState<Visitors | null>(null)

  useEffect(() => {
    const c = new AbortController()
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      await pingVisit(c.signal)
      const v = await fetchVisitors(c.signal)
      if (!c.signal.aborted) setVisitors(v)
    }
    void tick()
    const id = setInterval(() => void tick(), PING_MS)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [])

  return visitors
}
