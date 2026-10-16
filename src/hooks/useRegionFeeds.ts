import { useEffect, useState } from 'react'
import { fetchTripUpdates, type TransitRegion } from '../api/translink'
import { MAIN_REGIONS, PROBED_REGIONS, realtimeState, type FeedCounts, type RealtimeState } from '../lib/transitRegions'

// TransLink answers a GTFS-RT endpoint for every regional network, but most
// send an empty feed. Each is read every 5 minutes while something needs to
// know, and only those listing trips are polled with SEQ and Cairns.

const visible = () => document.visibilityState === 'visible'

const store = {
  counts: {} as FeedCounts,
  listeners: new Set<() => void>(),
  stop: null as (() => void) | null,
}

/**
 * Records how many trips a region's TripUpdates feed listed. Listeners hear
 * only when a region is first read or starts or stops listing trips, so a
 * poller that records counts can also listen without looping.
 */
export function recordFeedCount(region: TransitRegion, trips: number) {
  const before = store.counts[region]
  store.counts = { ...store.counts, [region]: trips }
  if (before == null || before > 0 !== trips > 0) store.listeners.forEach((l) => l())
}

export function feedCounts() {
  return store.counts
}

/** Listens for regions starting or stopping real-time, probing the regional feeds while anything listens. */
export function subscribeFeedCounts(listener: () => void) {
  store.listeners.add(listener)
  if (!store.stop) {
    const c = new AbortController()
    const probe = () =>
      PROBED_REGIONS.forEach((r) =>
        fetchTripUpdates([r], c.signal).then(
          (u) => recordFeedCount(r, u.trips.length),
          // A feed that can't be read lists nothing we can show.
          () => !c.signal.aborted && store.counts[r] == null && recordFeedCount(r, 0),
        ),
      )
    probe()
    const id = setInterval(() => visible() && probe(), 5 * 60_000)
    store.stop = () => (c.abort(), clearInterval(id))
  }
  return () => {
    store.listeners.delete(listener)
    if (!store.listeners.size) {
      store.stop?.()
      store.stop = null
    }
  }
}

/** Trips each regional real-time feed listed when last read, kept current while `enabled`. */
export function useFeedCounts(enabled: boolean): FeedCounts {
  const [counts, setCounts] = useState(feedCounts)
  useEffect(() => (enabled ? subscribeFeedCounts(() => setCounts(feedCounts())) : undefined), [enabled])
  return enabled ? counts : {}
}

/** Whether a region's stop pages can show real-time, from its feed's last read. */
export function useRealtimeState(region: TransitRegion): RealtimeState {
  return realtimeState(region, useFeedCounts(!MAIN_REGIONS.includes(region)))
}
