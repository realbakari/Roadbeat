import { useEffect, useState } from 'react'
import { brisbaneDate } from '../api/airHistory'
import { fetchHotspots, type Hotspot } from '../api/hotspots'
import { latestImageryDate } from '../api/satelliteImagery'
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

/**
 * The day of NASA's satellite image to show: the one the rider picked, or by
 * default the newest day NASA has published over Brisbane, checked once when
 * the layer is first turned on. `latest` is null until known, or when none of
 * the last four days is published.
 */
export function useSatelliteImagery(enabled: boolean, now: number) {
  const [latest, setLatest] = useState<{ date: string | null; error: string | null } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const today = brisbaneDate(now)
  const checked = latest != null
  useEffect(() => {
    if (!enabled || checked) return
    const c = new AbortController()
    latestImageryDate(today, c.signal).then(
      (date) => setLatest({ date, error: null }),
      (e: Error) => !c.signal.aborted && setLatest({ date: null, error: e.message }),
    )
    return () => c.abort()
  }, [enabled, checked, today])
  return {
    date: picked ?? latest?.date ?? null,
    latest: latest?.date ?? null,
    checking: enabled && !checked,
    error: latest?.error ?? null,
    today,
    pick: setPicked,
  }
}
