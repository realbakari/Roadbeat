import { useEffect, useState } from 'react'
import { fetchNews } from '../api/news'
import type { NewsSnapshot } from '../api/newsTypes'
import { poll } from './poll'

/**
 * The Queensland news monitor's reports, polled every 2 minutes while `enabled`.
 * The server reads the feeds every 5 minutes; `snapshot.fetchedAt` says when.
 */
export function useNews(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<NewsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchNews(c.signal).then(
        (s) => (setSnapshot(s), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const stop = poll(load, 120_000, true)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return { snapshot: enabled ? snapshot : null, error: enabled ? error : null }
}
