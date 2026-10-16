import type { TransitRegion, TripUpdates } from '../api/transitTypes'

/**
 * One snapshot from each region's TripUpdates read so far, or null until the
 * first one arrives. An empty snapshot would read as "no departures" while
 * the feed is still loading, or after it failed.
 */
export function mergeTripParts(parts: TripUpdates[]): TripUpdates | null {
  if (!parts.length) return null
  return { at: Object.assign({}, ...parts.map((p) => p.at)), trips: parts.flatMap((p) => p.trips) }
}

/** Whether `region`'s own feed has been read, so its absence of trips means something. */
export function regionRead(updates: TripUpdates | null, region: TransitRegion): boolean {
  return updates?.at[region] != null
}
