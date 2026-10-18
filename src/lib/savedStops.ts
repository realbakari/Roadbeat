import { isTransitRegion, type TransitRegion } from '../api/transitTypes'
import { moveTrip, removeTrip, renameTrip, saveTrip, type SavedTrip } from './savedTrips'
import { storedList } from './storedList'

// Stops a rider has saved ("My stops") and recently opened, and their saved trips
// ("My trips"), kept in this browser only.

export interface SavedStop {
  region: TransitRegion
  id: string
}

/** A stored stop: a region the app knows and a stop id. */
export function isSavedStop(x: unknown): x is SavedStop {
  const s = x as Partial<SavedStop> | null
  return !!s && typeof s.id === 'string' && typeof s.region === 'string' && isTransitRegion(s.region)
}

const same = (a: SavedStop, b: SavedStop) => a.region === b.region && a.id === b.id

const saved = storedList('qldt-saved-stops', isSavedStop)
export function toggleSavedStop(s: SavedStop) {
  const list = saved.read()
  saved.write(list.some((x) => same(x, s)) ? list.filter((x) => !same(x, s)) : [...list, s])
}
export const useSavedStops = saved.use

const RECENT_MAX = 6
const recent = storedList('qldt-recent-stops', isSavedStop)
/** Remembers a stop page the rider opened, most recent first. */
export function recordRecentStop(s: SavedStop) {
  const list = recent.read()
  if (same(list[0] ?? { region: 'SEQ', id: '' }, s)) return
  recent.write([s, ...list.filter((x) => !same(x, s))].slice(0, RECENT_MAX))
}
export function clearRecentStops() {
  recent.write([])
}
export const useRecentStops = recent.use

const trips = storedList<SavedTrip>('qldt-saved-trips')
/** Saves a trip, or updates the saved one between the same stops. */
export const keepSavedTrip = (t: SavedTrip) => trips.write(saveTrip(trips.read(), t))
export const removeSavedTrip = (t: SavedTrip) => trips.write(removeTrip(trips.read(), t))
export const renameSavedTrip = (t: SavedTrip, name: string) => trips.write(renameTrip(trips.read(), t, name))
export const moveSavedTrip = (t: SavedTrip, by: number) => trips.write(moveTrip(trips.read(), t, by))
export const useSavedTrips = trips.use
