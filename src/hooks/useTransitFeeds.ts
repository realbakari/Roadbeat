import { useEffect, useState } from 'react'
import { fetchTransit } from '../api/client'
import { loadStops, loadTrips, type StopIndex, type TripIndex } from '../api/stops'
import { loadTimetableIndex, type TimetableIndex } from '../api/timetables'
import { fetchTransitAlerts, fetchTripUpdates, fetchVehicles, type TransitAlert } from '../api/translink'
import type { LiveVehicle, TransitRegion, TripUpdates } from '../api/transitTypes'
import type { TransitLine, TransitNotice } from '../api/types'
import { watchFeed, type FeedWatch } from '../lib/trip'
import { mergeTripParts } from '../lib/tripFeed'
import { liveRegions, MAIN_REGIONS } from '../lib/transitRegions'
import { poll } from './poll'
import { feedCounts, recordFeedCount, subscribeFeedCounts, useFeedCounts } from './useRegionFeeds'

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
    const stop = poll(load, 2 * 60_000)
    return () => {
      live = false
      stop()
    }
  }, [enabled])
  return { data, error }
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
    const stop = poll(load, 15_000)
    return () => {
      c.abort()
      stop()
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
    const stop = poll(load, 60_000, !region)
    return () => {
      c.abort()
      stop()
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
  /** When each region last answered, and which regions' latest read failed. */
  fetchedAt: {} as Partial<Record<TransitRegion, number>>,
  failing: new Set<TransitRegion>(),
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
            tripFeed.fetchedAt = { ...tripFeed.fetchedAt, [r]: Date.now() }
            tripFeed.failing = new Set([...tripFeed.failing].filter((x) => x !== r))
            notify()
            if (!MAIN_REGIONS.includes(r)) recordFeedCount(r, u.trips.length)
          },
          (e: Error) => {
            if (c.signal.aborted) return
            tripFeed.failing = new Set([...tripFeed.failing, r])
            if (!parts.size) tripFeed.error = e.message
            notify()
          },
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
    const stop = poll(() => follow().forEach(read), 30_000)
    const unprobe = subscribeFeedCounts(() =>
      follow()
        .filter((r) => !parts.has(r))
        .forEach(read),
    )
    tripFeed.stop = () => (c.abort(), stop(), unprobe())
  }
  return () => {
    tripFeed.listeners.delete(listener)
    if (!tripFeed.listeners.size) {
      tripFeed.stop?.()
      tripFeed.stop = null
    }
  }
}

/**
 * TransLink GTFS-RT trip updates (real-time departures), polled every 30 s while `enabled`.
 * `error` is set only while nothing has loaded; after that a failed read keeps the last
 * updates and shows in `failing` and `fetchedAt` for that region.
 */
export function useTripUpdates(enabled: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => (enabled ? subscribeTripUpdates(() => setTick((n) => n + 1)) : undefined), [enabled])
  return {
    updates: enabled ? tripFeed.updates : null,
    watch: enabled ? tripFeed.watch : null,
    error: enabled ? tripFeed.error : null,
    fetchedAt: tripFeed.fetchedAt,
    failing: tripFeed.failing,
  }
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
