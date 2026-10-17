import { useEffect, useState } from 'react'
import { fetchHotspots, type Hotspot } from '../api/hotspots'
import { poll } from './poll'

/**
 * Geoscience Australia's satellite hotspots for Queensland in the last 24
 * hours, read every 10 minutes while `enabled`. New satellite passes are
 * processed through the day, so the list grows between reads.
 */
export function useHotspots(enabled: boolean) {
  const [hotspots, setHotspots] = useState<Hotspot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchHotspots(c.signal).then(
        (h) => (setHotspots(h), setError(null), setFetchedAt(Date.now())),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const stop = poll(load, 10 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return { hotspots: enabled ? hotspots : null, error: enabled ? error : null, fetchedAt: enabled ? fetchedAt : null }
}
