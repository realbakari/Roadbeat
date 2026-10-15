import { useSyncExternalStore } from 'react'
import type { TransitRegion } from '../api/translink'

// Stops a rider has saved ("My stops") and recently opened, kept in this browser only.

export interface SavedStop {
  region: TransitRegion
  id: string
}

/** A small list kept in localStorage, shared live between components. */
export function storedList<T>(key: string) {
  const listeners = new Set<() => void>()
  let cache: T[] | null = null
  const read = (): T[] => {
    if (cache) return cache
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? '[]')
      cache = Array.isArray(v) ? v : []
    } catch {
      cache = []
    }
    return cache!
  }
  const write = (list: T[]) => {
    cache = list
    try {
      localStorage.setItem(key, JSON.stringify(list))
    } catch {
      // Private mode or blocked storage: keep it for this visit only.
    }
    listeners.forEach((l) => l())
  }
  const use = () =>
    useSyncExternalStore(
      (l) => (listeners.add(l), () => listeners.delete(l)),
      read,
      read,
    )
  return { read, write, use }
}

const same = (a: SavedStop, b: SavedStop) => a.region === b.region && a.id === b.id

const saved = storedList<SavedStop>('qldt-saved-stops')
export function toggleSavedStop(s: SavedStop) {
  const list = saved.read()
  saved.write(list.some((x) => same(x, s)) ? list.filter((x) => !same(x, s)) : [...list, s])
}
export const useSavedStops = saved.use

const RECENT_MAX = 6
const recent = storedList<SavedStop>('qldt-recent-stops')
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

/** A journey a rider has saved ("My trips"), re-planned from now when opened. */
export interface SavedTrip {
  region: TransitRegion
  from: string
  to: string
}
const trips = storedList<SavedTrip>('qldt-saved-trips')
const sameTrip = (a: SavedTrip, b: SavedTrip) => a.region === b.region && a.from === b.from && a.to === b.to
export function toggleSavedTrip(t: SavedTrip) {
  const list = trips.read()
  trips.write(list.some((x) => sameTrip(x, t)) ? list.filter((x) => !sameTrip(x, t)) : [...list, t])
}
export const useSavedTrips = trips.use
