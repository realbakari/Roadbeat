import { useEffect, useState } from 'react'
import { fetchAirQuality, type AirStation } from '../api/airQuality'
import { fetchBushfires, type FireWarning } from '../api/bushfires'
import { fetchFireBans, type FireBans } from '../api/fireBans'
import { fetchCyclones, type Cyclone } from '../api/jtwc'
import { fetchModelForecast, type ModelForecast } from '../api/modelForecast'
import { fetchNswFires, type NswFire } from '../api/nswFires'
import { fetchPastCyclones, type PastCyclone } from '../api/pastCyclones'
import { fetchSpeedCameras, type SpeedCamera } from '../api/speedCameras'
import type { LngLat } from '../lib/geo'
import { poll } from './poll'
import { fetchFuelStations, type FuelStation } from '../api/fuelAvailability'

/** A polled feed's last read: its value, the error from the latest read, and when it last succeeded. */
export interface Feed<T> {
  data: T | null
  error: string | null
  fetchedAt: number | null
}

/**
 * Reads `load` while `enabled`, again every `ms` (paused in a hidden tab unless
 * `raisesAlerts`), keeping the last good value when a later read fails.
 */
function usePolled<T>(enabled: boolean, load: (signal: AbortSignal) => Promise<T>, ms: number | null, raisesAlerts = false): Feed<T> {
  const [state, setState] = useState<Feed<T>>({ data: null, error: null, fetchedAt: null })
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const run = () =>
      load(c.signal).then(
        (data) => setState({ data, error: null, fetchedAt: Date.now() }),
        (e: Error) => !c.signal.aborted && setState((s) => ({ ...s, error: e.message })),
      )
    run()
    const stop = ms ? poll(run, ms, raisesAlerts) : () => {}
    return () => {
      c.abort()
      stop()
    }
    // Each hook below passes a module-level fetcher, so `load` never changes between renders.
  }, [enabled, load, ms, raisesAlerts])
  return enabled ? state : { data: null, error: null, fetchedAt: null }
}

/** The Queensland Fire Department's fire bans, read every 10 minutes while the bushfire layer is on. */
export const useFireBans = (enabled: boolean): Feed<FireBans> => usePolled(enabled, fetchFireBans, 10 * 60_000)

/** NSW RFS incidents near the Queensland border, read every 2 minutes while their layer is on. */
export const useNswFires = (enabled: boolean): Feed<NswFire[]> => usePolled(enabled, fetchNswFires, 2 * 60_000)

/** JTWC's current tropical cyclones near Australia, read every 30 minutes (JTWC warns every 6 hours) while their layer is on. */
export const useCyclones = (enabled: boolean): Feed<Cyclone[]> => usePolled(enabled, fetchCyclones, 30 * 60_000)

/** Past cyclone tracks near Queensland, read once when their layer is first turned on. */
export const usePastCyclones = (enabled: boolean): Feed<PastCyclone[]> => usePolled(enabled, fetchPastCyclones, null)

/** The state's fixed, red light and point-to-point camera sites, read once when their layer is first turned on. */
/** Fuel availability at service stations, read every 5 minutes (the server's cache) while the layer or a station page is open. */
export const useFuelStations = (enabled: boolean): Feed<FuelStation[]> => usePolled(enabled, fetchFuelStations, 5 * 60_000)

export const useSpeedCameras = (enabled: boolean): Feed<SpeedCamera[]> => usePolled(enabled, fetchSpeedCameras, null)

/** The DWD ICON model forecast for one point, read when `at` is set, and again if it changes. */
export function useModelForecast(at: LngLat | null): Feed<ModelForecast> {
  const key = at ? `${at[0].toFixed(3)},${at[1].toFixed(3)}` : null
  const [state, setState] = useState<Feed<ModelForecast> & { key: string | null }>({ key: null, data: null, error: null, fetchedAt: null })
  useEffect(() => {
    if (!key) return
    const [lng, lat] = key.split(',').map(Number)
    const c = new AbortController()
    fetchModelForecast([lng, lat], c.signal).then(
      (data) => setState({ key, data, error: data ? null : 'The forecast came back empty', fetchedAt: Date.now() }),
      (e: Error) => !c.signal.aborted && setState({ key, data: null, error: e.message, fetchedAt: null }),
    )
    return () => c.abort()
  }, [key])
  return state.key === key ? state : { data: null, error: null, fetchedAt: null }
}

/** Queensland Fire Department bushfire warnings and incidents, polled every 2 minutes while `enabled`. */
export function useBushfires(enabled: boolean) {
  const [fires, setFires] = useState<FireWarning[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchBushfires(c.signal).then(
        (f) => (setFires(f), setError(null), setFetchedAt(Date.now())),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const stop = poll(load, 120_000, true)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return { fires: enabled ? fires : null, error: enabled ? error : null, fetchedAt: enabled ? fetchedAt : null }
}

/** The state's hourly air quality readings, polled every 10 minutes while `enabled`. */
export function useAirQuality(enabled: boolean) {
  const [stations, setStations] = useState<AirStation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchAirQuality(c.signal).then(
        (s) => (setStations(s), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const stop = poll(load, 10 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return { stations: enabled ? stations : null, error: enabled ? error : null }
}
