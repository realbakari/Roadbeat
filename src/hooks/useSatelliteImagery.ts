import { useEffect, useState } from 'react'
import { himawariFrames, type HimawariBand } from '../api/himawari'
import { mergeFrames } from '../lib/frames'
import { fetchJmaFrames, type JmaFrame } from '../api/jmaHimawari'
import { latestImageryDate, type DailyPass } from '../api/satelliteImagery'
import { dailyPass, isGibsLive, jmaProduct, type SatelliteSource } from '../lib/satelliteImage'
import { poll } from './poll'
import { brisbaneDate } from '../lib/aest'

/**
 * The Himawari-9 image times GIBS lists for `band`, read when the band is
 * chosen and every 5 minutes after (a new image comes every 10). GIBS's
 * servers don't all list the newest image at once, so every read's times are
 * kept (`mergeFrames`) and the map never steps back to an older image. Null
 * `band` stops reading.
 */
function useHimawari(band: HimawariBand | null) {
  const [state, setState] = useState<{ band: HimawariBand; frames: string[]; error: string | null } | null>(null)
  useEffect(() => {
    if (!band) return
    const c = new AbortController()
    const load = () =>
      himawariFrames(band, Date.now(), c.signal).then(
        (frames) => setState((s) => ({ band, frames: mergeFrames(s?.band === band ? s.frames : [], frames).slice(-300), error: null })),
        (e: Error) => !c.signal.aborted && setState((s) => ({ band, frames: s?.band === band ? s.frames : [], error: e.message })),
      )
    load()
    const stop = poll(load, 5 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [band])
  const current = band && state?.band === band ? state : null
  const frames = current?.frames ?? []
  return { frames, time: frames.at(-1) ?? null, error: current?.error ?? null, checking: !!band && !current }
}

/** Every Himawari-9 image JMA lists, oldest first, read while `enabled` and every 2 minutes after (JMA lists each a few minutes after it's taken). */
function useJmaFrames(enabled: boolean) {
  const [state, setState] = useState<{ frames: JmaFrame[]; error: string | null } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchJmaFrames(c.signal).then(
        (frames) => setState({ frames, error: null }),
        (e: Error) => !c.signal.aborted && setState((s) => ({ frames: s?.frames ?? [], error: e.message })),
      )
    load()
    const stop = poll(load, 2 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  const frames = enabled ? (state?.frames ?? []) : []
  return { frames, latest: frames.at(-1) ?? null, error: enabled ? (state?.error ?? null) : null, checking: enabled && !state }
}

/** The newest day each daily pass has published over Brisbane, checked once per pass when it is first chosen. */
function useDailyLatest(pass: DailyPass | null, today: string) {
  const [latest, setLatest] = useState<Partial<Record<DailyPass, { date: string | null; error: string | null }>>>({})
  const checked = pass ? latest[pass] != null : true
  useEffect(() => {
    if (!pass || checked) return
    const c = new AbortController()
    latestImageryDate(today, c.signal, pass).then(
      (date) => setLatest((l) => ({ ...l, [pass]: { date, error: null } })),
      (e: Error) => !c.signal.aborted && setLatest((l) => ({ ...l, [pass]: { date: null, error: e.message } })),
    )
    return () => c.abort()
  }, [pass, checked, today])
  return pass ? { ...(latest[pass] ?? { date: null, error: null }), checking: !checked } : { date: null, error: null, checking: false }
}

/**
 * The satellite image to show. Only one is on at a time: Himawari-9's live
 * image from NASA GIBS (infrared by default) or JMA, or NASA's image for one
 * day from NOAA-20 or Terra, the day the rider picked or by default the newest
 * one published over Brisbane.
 */
export function useSatelliteImagery(enabled: boolean, source: SatelliteSource, now: number) {
  const [picked, setPicked] = useState<{ pass: DailyPass; date: string } | null>(null)
  const today = brisbaneDate(now)
  const pass = enabled ? dailyPass(source) : null
  const daily = useDailyLatest(pass, today)
  const live = useHimawari(enabled && isGibsLive(source) ? source : null)
  const jma = useJmaFrames(enabled && jmaProduct(source) != null)
  return {
    live,
    jma,
    date: (pass && picked?.pass === pass ? picked.date : null) ?? daily.date,
    latest: daily.date,
    checking: daily.checking,
    error: daily.error,
    today,
    pick: (date: string) => pass && setPicked({ pass, date }),
  }
}
