import { useEffect, useRef, useState } from 'react'
import { fetchCouncilEventsOn, type CouncilEvent } from '../api/bccDashboard'
import { fetchGauges, type Gauge } from '../api/bccGauges'
import { fetchCarParkSpaces, type CarParkSpaces } from '../api/bccParking'
import { fetchAccessibleBays, fetchBikeStops, fetchClearways, fetchParkingMeters, fetchToilets, type AccessibleBay, type BikeStop, type Clearway, type ParkingMeter, type Toilet } from '../api/bccPlaces'
import { fetchRoadOccupancies, type RoadOccupancy } from '../api/bccRoadOccupancies'
import { fetchSignalVolumes, loadSignalSites, type SignalSite, type SignalVolumes } from '../api/bccSignals'
import { fetchQldGauges } from '../api/qldGauges'
import { eventsWeek } from '../lib/councilEvents'
import { gaugeNotice, type GaugeFailure } from '../lib/feedNotice'
import { poll } from './poll'

// Brisbane City Council's feeds (gauges, signals, road occupancies, car parks
// and its places), with the state's stream gauges read alongside the council's.

/**
 * Brisbane City Council stream and rain gauges with their last 24 hours of
 * readings, and Queensland's statewide stream gauges with their latest reading,
 * polled every 5 minutes while `enabled`. If one source fails, the other's gauges
 * still show and `error` names the failure.
 */
export function useGauges(enabled: boolean) {
  const [gauges, setGauges] = useState<Gauge[] | null>(null)
  const [failed, setFailed] = useState<GaugeFailure[]>([])
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      Promise.allSettled([fetchGauges(c.signal), fetchQldGauges(c.signal)]).then((results) => {
        if (c.signal.aborted) return
        const sources = ['Brisbane City Council', 'Queensland Government']
        const now = results.flatMap((r, i) => (r.status === 'rejected' ? [{ source: sources[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) }] : []))
        if (now.length < results.length) {
          setGauges(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
          setFetchedAt(Date.now())
        }
        setFailed(now.length === results.length ? [{ source: 'all', error: now[0].error }] : now)
      })
    load()
    const stop = poll(load, 5 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return { gauges: enabled ? gauges : null, notice: enabled ? gaugeNotice(gauges != null, failed, fetchedAt) : null }
}

/**
 * Brisbane City Council signal sites and their latest measured volumes, polled
 * every 2 minutes while `enabled`. The council publishes about every 5 minutes,
 * so a poll shortly after each batch keeps the map at most a couple of minutes behind.
 */
export function useSignals(enabled: boolean) {
  const [sites, setSites] = useState<SignalSite[] | null>(null)
  const [volumes, setVolumes] = useState<SignalVolumes | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadSignalSites().then((s) => live && setSites(s))
    const c = new AbortController()
    const load = () =>
      fetchSignalVolumes(c.signal).then(
        (v) => (setVolumes(v), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const stop = poll(load, 2 * 60_000)
    return () => {
      live = false
      c.abort()
      stop()
    }
  }, [enabled])
  return { sites: enabled ? sites : null, volumes: enabled ? volumes : null, error: enabled ? error : null }
}

/** Brisbane City Council planned road occupancies, refreshed every 30 minutes while `enabled` (the council updates them daily). */
export function useRoadOccupancies(enabled: boolean) {
  const [list, setList] = useState<RoadOccupancy[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () => fetchRoadOccupancies(c.signal).then(setList, () => {})
    load()
    const stop = poll(load, 30 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return enabled ? list : null
}

/** Vacant spaces at the council's CBD car parks, polled every 5 minutes while `enabled`. */
export function useCarParkSpaces(enabled: boolean) {
  const [spaces, setSpaces] = useState<CarParkSpaces | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () => fetchCarParkSpaces(c.signal).then(setSpaces, () => {})
    load()
    const stop = poll(load, 5 * 60_000)
    return () => {
      c.abort()
      stop()
    }
  }, [enabled])
  return enabled ? spaces : null
}

/** A council layer that changes rarely: loaded once per visit, the first time something shows it. */
function useLoadOnce<T>(enabled: boolean, load: (signal: AbortSignal) => Promise<T[]>) {
  const [list, setList] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = list != null
  const loader = useRef(load)
  useEffect(() => {
    if (!enabled || loaded) return
    const c = new AbortController()
    loader.current(c.signal).then(
      (l) => (setList(l), setError(null)),
      (e: Error) => !c.signal.aborted && setError(e.message),
    )
    return () => c.abort()
  }, [enabled, loaded])
  return { list: enabled ? list : null, error: enabled ? error : null }
}

const loadEventsWeek = (signal: AbortSignal) => {
  const { from, to } = eventsWeek(Date.now())
  return fetchCouncilEventsOn(from, to, signal)
}

/** Brisbane City Council clearways, toilets, accessible parking, parking meters, bike racks and this week's events, each loaded when its layer or a detail page needs it. */
export function useCouncilPlaces(show: { clearways: boolean; toilets: boolean; accessibleParking: boolean; parkingMeters: boolean; cycling: boolean; councilEvents: boolean }) {
  const clearways = useLoadOnce<Clearway>(show.clearways, fetchClearways)
  const toilets = useLoadOnce<Toilet>(show.toilets, fetchToilets)
  const bays = useLoadOnce<AccessibleBay>(show.accessibleParking, fetchAccessibleBays)
  const meters = useLoadOnce<ParkingMeter>(show.parkingMeters, fetchParkingMeters)
  const bikeStops = useLoadOnce<BikeStop>(show.cycling, fetchBikeStops)
  const events = useLoadOnce<CouncilEvent>(show.councilEvents, loadEventsWeek)
  return {
    clearways: clearways.list,
    toilets: toilets.list,
    bays: bays.list,
    meters: meters.list,
    bikeStops: bikeStops.list,
    events: events.list,
    errors: { clearways: clearways.error, toilets: toilets.error, accessibleParking: bays.error, parkingMeters: meters.error, cycling: bikeStops.error, councilEvents: events.error },
  }
}
