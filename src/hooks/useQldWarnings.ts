import { useEffect, useState } from 'react'
import { fetchQldWarnings, type QldWarning } from '../api/qldWarnings'
import { poll } from './poll'

/**
 * Queensland's severe weather, flood and cyclone warnings, read every 2
 * minutes, and in a hidden tab too while system notifications are on, as they
 * raise alerts. The publisher says its map data can be up to 5 minutes behind.
 * An empty list is a real state: no current warnings.
 */
export function useQldWarnings(enabled = true) {
  const [warnings, setWarnings] = useState<QldWarning[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchQldWarnings(c.signal).then(
        (w) => (setWarnings(w), setError(null), setFetchedAt(Date.now())),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const stop = poll(load, 120_000, true)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return { warnings: enabled ? warnings : null, error: enabled ? error : null, fetchedAt: enabled ? fetchedAt : null }
}
