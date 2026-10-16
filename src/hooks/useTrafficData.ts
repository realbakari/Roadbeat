import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchCameras,
  fetchDistricts,
  fetchDumpPoints,
  fetchEvents,
  fetchRestAreas,
  fetchTransit,
  fetchTruckRestrictions,
  fetchWaze,
} from '../api/client'
import { fetchGauges, type Gauge } from '../api/bccGauges'
import { fetchQldGauges } from '../api/qldGauges'
import { fetchSignalVolumes, loadSignalSites, type SignalSite, type SignalVolumes } from '../api/bccSignals'
import { fetchBushfires, type FireWarning } from '../api/bushfires'
import { fetchAirQuality, type AirStation } from '../api/airQuality'
import { fetchNews } from '../api/news'
import type { NewsSnapshot } from '../api/newsTypes'
import { fetchClearances, type Clearance } from '../api/clearances'
import { fetchCouncilEventsOn, type CouncilEvent } from '../api/bccDashboard'
import { eventsWeek } from '../lib/councilEvents'
import { fetchAccessibleBays, fetchBikeStops, fetchClearways, fetchParkingMeters, fetchToilets, type AccessibleBay, type BikeStop, type Clearway, type ParkingMeter, type Toilet } from '../api/bccPlaces'
import { fetchRoadOccupancies, type RoadOccupancy } from '../api/bccRoadOccupancies'
import { fetchCarParkSpaces, type CarParkSpaces } from '../api/bccParking'
import { loadTimetableIndex, type TimetableIndex } from '../api/timetables'
import { loadStops, loadTrips, type StopIndex, type TripIndex } from '../api/stops'
import {
  fetchTransitAlerts,
  fetchTripUpdates,
  fetchVehicles,
  type TripUpdates,
  type LiveVehicle,
  type TransitAlert,
  type TransitRegion,
} from '../api/translink'
import { watchFeed, type FeedWatch } from '../lib/trip'
import { mergeTripParts } from '../lib/tripFeed'
import { liveRegions, MAIN_REGIONS } from '../lib/transitRegions'
import { feedCounts, recordFeedCount, subscribeFeedCounts, useFeedCounts } from './useRegionFeeds'
import type {
  Camera,
  DumpPoint,
  RestArea,
  TrafficEvent,
  TransitLine,
  TransitNotice,
  TruckRestriction,
  WazeReport,
} from '../api/types'

const EVENTS_INTERVAL = 60_000 // same cadence as the official site's auto refresh
const CAMERAS_INTERVAL = 5 * 60_000

export type Districts = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { district: string }>

interface State {
  events: TrafficEvent[]
  cameras: Camera[]
  waze: WazeReport[]
  loading: boolean
  refreshing: boolean
  error: string | null
  fetchedAt: number | null
}

const visible = () => document.visibilityState === 'visible'

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
    const e = setInterval(() => visible() && loadEvents(), EVENTS_INTERVAL)
    const c = setInterval(() => visible() && loadCameras(), CAMERAS_INTERVAL)
    return () => {
      clearInterval(e)
      clearInterval(c)
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

/** TransLink network status; only polls while `enabled` (the Transit tab is open). */
export function useTransit(enabled: boolean) {
  const [data, setData] = useState<{ lines: TransitLine[]; notices: TransitNotice[] } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let live = true
    const load = () =>
      fetchTransit().then(
        (d) => live && (setData(d), setError(false)),
        () => live && setError(true),
      )
    load()
    const id = setInterval(() => visible() && load(), 2 * 60_000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [enabled])
  return { data, error }
}

/** Re-renders on an interval so relative timestamps stay fresh. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Live TransLink vehicle positions, polled every 15 s while `enabled`, for SEQ, Cairns and any region whose feed lists trips. */
export function useLiveVehicles(enabled: boolean) {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([])
  const [error, setError] = useState<string | null>(null)
  // Re-polls when a region starts or stops listing trips.
  const regions = liveRegions(useFeedCounts(enabled)).join(',')
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchVehicles(liveRegions(feedCounts()), c.signal).then(
        (v) => (setVehicles(v), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const id = setInterval(() => visible() && load(), 15_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled, regions])
  return { vehicles: enabled ? vehicles : [], error: enabled ? error : null }
}

/** TransLink GTFS-RT service alerts, polled every minute while `enabled`; SEQ and Cairns unless `region` names another. */
export function useTransitAlerts(enabled: boolean, region?: TransitRegion) {
  const [alerts, setAlerts] = useState<TransitAlert[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchTransitAlerts(region ? [region] : [...MAIN_REGIONS], c.signal).then(
        (a) => (setAlerts(a), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const id = setInterval(() => visible() && load(), 60_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled, region])
  return { alerts, error }
}

// One poller for the trip updates feed (~670 KB gz), shared by every component
// that shows departures, so a line page's departures and timetable fetch it once.
const tripFeed = {
  updates: null as TripUpdates | null,
  /** Which trips the feed has listed while polled without a break, for overdue departures. */
  watch: null as FeedWatch | null,
  error: null as string | null,
  listeners: new Set<() => void>(),
  stop: null as (() => void) | null,
}

function subscribeTripUpdates(listener: () => void) {
  tripFeed.listeners.add(listener)
  if (!tripFeed.stop) {
    const c = new AbortController()
    const notify = () => tripFeed.listeners.forEach((l) => l())
    // Each region is fetched on its own and shown as soon as it arrives.
    const parts = new Map<TransitRegion, TripUpdates>()
    const publish = () => (tripFeed.updates = mergeTripParts([...parts.values()]))
    const reading = new Set<TransitRegion>()
    const read = (r: TransitRegion) => {
      if (reading.has(r)) return
      reading.add(r)
      fetchTripUpdates([r], c.signal)
        .then(
          (u) => {
            parts.set(r, u)
            tripFeed.watch = watchFeed(tripFeed.watch, r, u)
            publish()
            tripFeed.error = null
            notify()
            if (!MAIN_REGIONS.includes(r)) recordFeedCount(r, u.trips.length)
          },
          (e: Error) => !c.signal.aborted && !parts.size && ((tripFeed.error = e.message), notify()),
        )
        .finally(() => reading.delete(r))
    }
    // A region whose feed has gone quiet keeps none of its last trips; one that starts listing trips is read straight away.
    const follow = () => {
      const regions = liveRegions(feedCounts())
      for (const r of parts.keys()) if (!regions.includes(r)) parts.delete(r)
      publish()
      notify()
      return regions
    }
    follow().forEach(read)
    const id = setInterval(() => visible() && follow().forEach(read), 30_000)
    const unprobe = subscribeFeedCounts(() =>
      follow()
        .filter((r) => !parts.has(r))
        .forEach(read),
    )
    tripFeed.stop = () => (c.abort(), clearInterval(id), unprobe())
  }
  return () => {
    tripFeed.listeners.delete(listener)
    if (!tripFeed.listeners.size) {
      tripFeed.stop?.()
      tripFeed.stop = null
    }
  }
}

/** TransLink GTFS-RT trip updates (real-time departures), polled every 30 s while `enabled`. */
export function useTripUpdates(enabled: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => (enabled ? subscribeTripUpdates(() => setTick((n) => n + 1)) : undefined), [enabled])
  return { updates: enabled ? tripFeed.updates : null, watch: enabled ? tripFeed.watch : null, error: enabled ? tripFeed.error : null }
}

/** Published timetable index (which routes serve each stop, and the dates covered). */
export function useTimetableIndex(enabled: boolean) {
  const [index, setIndex] = useState<TimetableIndex | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadTimetableIndex().then((i) => live && (i ? setIndex(i) : setFailed(true)))
    return () => {
      live = false
    }
  }, [enabled])
  return { index: enabled ? index : null, failed }
}

/** Published stop names; `withBus` also loads the (larger) bus stop table. Null until loaded or when disabled. */
export function useStopIndex(enabled: boolean, withBus: boolean) {
  const [index, setIndex] = useState<StopIndex | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadStops(withBus).then((i) => live && setIndex(i))
    return () => {
      live = false
    }
  }, [enabled, withBus])
  return enabled ? index : null
}

/** Published trip headsigns and directions. */
export function useTripIndex(enabled: boolean) {
  const [index, setIndex] = useState<TripIndex | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    loadTrips().then((i) => live && setIndex(i))
    return () => {
      live = false
    }
  }, [enabled])
  return enabled ? index : null
}

/** Queensland Fire Department bushfire warnings and incidents, polled every 2 minutes while `enabled`. */
export function useBushfires(enabled: boolean) {
  const [fires, setFires] = useState<FireWarning[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      fetchBushfires(c.signal).then(
        (f) => (setFires(f), setError(null)),
        (e: Error) => !c.signal.aborted && setError(e.message),
      )
    load()
    const id = setInterval(() => visible() && load(), 120_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled])
  return { fires: enabled ? fires : null, error: enabled ? error : null }
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
    const id = setInterval(() => visible() && load(), 10 * 60_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled])
  return { stations: enabled ? stations : null, error: enabled ? error : null }
}

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
    const id = setInterval(() => visible() && load(), 120_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled])
  return { snapshot: enabled ? snapshot : null, error: enabled ? error : null }
}

/**
 * Brisbane City Council stream and rain gauges with their last 24 hours of
 * readings, and Queensland's statewide stream gauges with their latest reading,
 * polled every 5 minutes while `enabled`. If one source fails, the other's gauges
 * still show and `error` names the failure.
 */
export function useGauges(enabled: boolean) {
  const [gauges, setGauges] = useState<Gauge[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () =>
      Promise.allSettled([fetchGauges(c.signal), fetchQldGauges(c.signal)]).then((results) => {
        if (c.signal.aborted) return
        const failed = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : []))
        if (failed.length < results.length) setGauges(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
        setError(failed[0] ?? null)
      })
    load()
    const id = setInterval(() => visible() && load(), 5 * 60_000)
    return () => {
      c.abort()
      clearInterval(id)
    }
  }, [enabled])
  return { gauges: enabled ? gauges : null, error: enabled ? error : null }
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
    const id = setInterval(() => visible() && load(), 2 * 60_000)
    return () => {
      live = false
      c.abort()
      clearInterval(id)
    }
  }, [enabled])
  return { sites: enabled ? sites : null, volumes: enabled ? volumes : null, error: enabled ? error : null }
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

/** Brisbane City Council planned road occupancies, refreshed every 30 minutes while `enabled` (the council updates them daily). */
export function useRoadOccupancies(enabled: boolean) {
  const [list, setList] = useState<RoadOccupancy[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    const c = new AbortController()
    const load = () => fetchRoadOccupancies(c.signal).then(setList, () => {})
    load()
    const id = setInterval(() => visible() && load(), 30 * 60_000)
    return () => {
      c.abort()
      clearInterval(id)
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
    const id = setInterval(() => visible() && load(), 5 * 60_000)
    return () => {
      c.abort()
      clearInterval(id)
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
