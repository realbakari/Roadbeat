import { useEffect, useState } from 'react'
import { brisbaneDate } from '../api/airHistory'
import { fetchHotspots, type Hotspot } from '../api/hotspots'
import { latestHimawariTime, newerTime, type HimawariBand } from '../api/himawari'
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

/** Which satellite image the map shows: Himawari-9's live infrared or visible image, or NASA's daily true-colour picture. */
export type SatelliteSource = HimawariBand | 'daily'

/**
 * The newest Himawari-9 image time GIBS lists for `band`, read when the band
 * is chosen and every 5 minutes after (a new image comes every 10), keeping
 * the newest time any read gave (`newerTime`). Null `band` stops reading.
 */
export function useHimawari(band: HimawariBand | null) {
  const [state, setState] = useState<{ band: HimawariBand; time: string | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!band) return
    const c = new AbortController()
    const load = () =>
      latestHimawariTime(band, Date.now(), c.signal).then(
        (time) => setState((s) => ({ band, time: newerTime(s?.band === band ? s.time : null, time), error: null })),
        (e: Error) => !c.signal.aborted && setState((s) => ({ band, time: s?.band === band ? s.time : null, error: e.message })),
      )
    load()
    const stop = poll(load, 5 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [band])
  const current = band && state?.band === band ? state : null
  return { time: current?.time ?? null, error: current?.error ?? null, checking: !!band && !current }
}

/**
 * The satellite image to show. Only one is on at a time: Himawari-9's live
 * image (infrared by default) or NASA's image for one day, the one the rider
 * picked or by default the newest day NASA has published over Brisbane,
 * checked once when it is first chosen. `latest` is null until known, or when
 * none of the last four days is published.
 */
export function useSatelliteImagery(enabled: boolean, now: number) {
  const [source, setSource] = useState<SatelliteSource>('infrared')
  const [latest, setLatest] = useState<{ date: string | null; error: string | null } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const today = brisbaneDate(now)
  const daily = enabled && source === 'daily'
  const checked = latest != null
  useEffect(() => {
    if (!daily || checked) return
    const c = new AbortController()
    latestImageryDate(today, c.signal).then(
      (date) => setLatest({ date, error: null }),
      (e: Error) => !c.signal.aborted && setLatest({ date: null, error: e.message }),
    )
    return () => c.abort()
  }, [daily, checked, today])
  const live = useHimawari(enabled && source !== 'daily' ? source : null)
  return {
    source,
    setSource,
    live,
    date: picked ?? latest?.date ?? null,
    latest: latest?.date ?? null,
    checking: daily && !checked,
    error: latest?.error ?? null,
    today,
    pick: setPicked,
  }
}
