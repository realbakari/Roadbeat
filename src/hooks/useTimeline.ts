import { useCallback, useEffect, useState } from 'react'
import { fetchHistory } from '../api/history'
import type { HistoryResponse } from '../api/historyTypes'
import { clampTime, SPEEDS, stepTime, TIMELINE_WINDOW_MS, type Speed } from '../lib/timeline'

const visible = () => document.visibilityState === 'visible'
/** How often play advances the chosen time. */
const TICK_MS = 250

/** The road event history, polled every 2 minutes while `enabled`. The server records a run every 5 minutes. */
export function useEventHistory(enabled: boolean) {
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchHistory(c.signal).then(
        (h) => (setHistory(h), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const id = setInterval(() => visible() && load(), 120_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled])
  return { history: enabled ? history : null, error: enabled ? error : null }
}

export interface TimelineState {
  /** The chosen time, or null for live. */
  at: number | null
  playing: boolean
  speed: Speed
  /** Chooses a time inside the last 48 hours. */
  seek: (t: number) => void
  play: () => void
  pause: () => void
  /** Cycles to the next replay speed. */
  faster: () => void
  /** Back to live. */
  live: () => void
}

/**
 * The scrubber's position. Play advances it at the chosen speed and returns
 * to live on reaching now. A time is never adjusted on its own: the position
 * stays where the viewer put it until they move it or play moves it.
 */
export function useTimeline(): TimelineState {
  const [at, setAt] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(SPEEDS[1])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setAt((t) => {
        const next = t == null ? null : stepTime(t, speed, TICK_MS, Date.now())
        if (next == null) setPlaying(false)
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, speed])

  const seek = useCallback((t: number) => setAt(clampTime(t, Date.now())), [])
  const play = useCallback(() => {
    // Play from live starts at the beginning of the window.
    setAt((t) => t ?? Date.now() - TIMELINE_WINDOW_MS)
    setPlaying(true)
  }, [])
  const pause = useCallback(() => setPlaying(false), [])
  const faster = useCallback(() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]), [])
  const live = useCallback(() => {
    setPlaying(false)
    setAt(null)
  }, [])
  return { at, playing, speed, seek, play, pause, faster, live }
}
