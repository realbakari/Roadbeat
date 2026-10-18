import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCameras, fetchDistricts, fetchDumpPoints, fetchEvents, fetchRestAreas, fetchTruckRestrictions, fetchWaze } from '../api/client'
import { fetchClearances, type Clearance } from '../api/clearances'
import type { Camera, Districts, DumpPoint, RestArea, TrafficEvent, TruckRestriction, WazeReport } from '../api/types'
import { poll } from './poll'

// The road feeds: QLDTraffic's events, cameras and reference layers, Waze, and
// the low clearance datasets.

const EVENTS_INTERVAL = 60_000 // same cadence as the official site's auto refresh
const CAMERAS_INTERVAL = 5 * 60_000

interface State {
  events: TrafficEvent[]
  cameras: Camera[]
  waze: WazeReport[]
  loading: boolean
  refreshing: boolean
  error: string | null
  fetchedAt: number | null
}

export function useTrafficData() {
  const [state, setState] = useState<State>({
    events: [],
    cameras: [],
    waze: [],
    loading: true,
    refreshing: false,
    error: null,
    fetchedAt: null,
  })
  const ctrl = useRef<AbortController | null>(null)

  const loadEvents = useCallback(async () => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setState((s) => ({ ...s, refreshing: true }))
    try {
      const [{ events }, waze] = await Promise.all([fetchEvents(c.signal), fetchWaze().catch(() => null)])
      setState((s) => ({
        ...s,
        events,
        waze: waze ?? s.waze,
        loading: false,
        refreshing: false,
        error: null,
        fetchedAt: Date.now(),
      }))
    } catch (err) {
      if (c.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Could not reach QLDTraffic.'
      setState((s) => ({ ...s, loading: false, refreshing: false, error: message }))
    }
  }, [])

  const loadCameras = useCallback(async () => {
    try {
      const cameras = await fetchCameras()
      setState((s) => ({ ...s, cameras }))
    } catch {
      // Cameras are secondary; keep the previous list and retry on the next tick.
    }
  }, [])

  useEffect(() => {
    loadEvents()
    loadCameras()
    const stopEvents = poll(loadEvents, EVENTS_INTERVAL, true)
    const stopCameras = poll(loadCameras, CAMERAS_INTERVAL)
    return () => {
      stopEvents()
      stopCameras()
      ctrl.current?.abort()
    }
  }, [loadEvents, loadCameras])

  return { ...state, refresh: loadEvents }
}

export interface ReferenceData {
  restAreas: RestArea[]
  dumpPoints: DumpPoint[]
  truckRestrictions: TruckRestriction[]
  districts: Districts
}

/** Slow-changing layers, fetched once per visit. */
export function useReferenceData(): ReferenceData {
  const [data, setData] = useState<ReferenceData>({
    restAreas: [],
    dumpPoints: [],
    truckRestrictions: [],
    districts: { type: 'FeatureCollection', features: [] },
  })
  useEffect(() => {
    fetchRestAreas().then((restAreas) => setData((d) => ({ ...d, restAreas })), () => {})
    fetchDumpPoints().then((dumpPoints) => setData((d) => ({ ...d, dumpPoints })), () => {})
    fetchTruckRestrictions().then((truckRestrictions) => setData((d) => ({ ...d, truckRestrictions })), () => {})
    fetchDistricts().then((districts) => setData((d) => ({ ...d, districts })), () => {})
  }, [])
  return data
}

/**
 * Low clearance bridges and structures, loaded once per visit the first time
 * something shows them. Both datasets change about monthly.
 */
export function useClearances(enabled: boolean) {
  const [list, setList] = useState<Clearance[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = list != null
  useEffect(() => {
    if (!enabled || loaded) return
    const c = new AbortController()
    fetchClearances(c.signal).then(
      (l) => (setList(l), setError(null)),
      (e: Error) => !c.signal.aborted && setError(e.message),
    )
    return () => c.abort()
  }, [enabled, loaded])
  return { clearances: enabled ? list : null, error: enabled ? error : null }
}
