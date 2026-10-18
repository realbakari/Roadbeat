import type { TrafficEvent } from '../api/types'
import { eventAnchor } from './eventAnchor'
import { isClosure, isCurrent } from './eventStatus'
import { distanceKm, type LngLat } from './geo'
import { storedList } from './storedList'

// "My places": localities a rider saves with their own nickname ("Home",
// "Mum's", "Work"), kept in this browser only. Each is listed above the road
// events with what QLDTraffic reports near it, and opens its place page
// (events, warnings, cameras and the model forecast).

export interface SavedPlace {
  /** The gazetteer locality's name, which its place page is found by. */
  name: string
  nickname: string
  position: LngLat
}

/** How far around a saved place the summary counts road events. */
export const NEAR_PLACE_KM = 5

/** Adds a place, or renames it when it's already saved. A blank nickname uses the place's own name. */
export function savePlace(list: SavedPlace[], p: SavedPlace): SavedPlace[] {
  const place = { ...p, nickname: p.nickname.trim() || p.name }
  return list.some((x) => x.name === p.name) ? list.map((x) => (x.name === p.name ? place : x)) : [...list, place]
}

export const removePlace = (list: SavedPlace[], name: string) => list.filter((x) => x.name !== name)

export interface PlaceSummary {
  events: number
  closures: number
}

/** Current road events (and closures among them) whose published point is within NEAR_PLACE_KM of the place. */
export function placeSummary(p: SavedPlace, events: TrafficEvent[], now: number): PlaceSummary {
  let n = 0
  let closures = 0
  for (const e of events) {
    if (!isCurrent(e, now)) continue
    const a = eventAnchor(e)
    if (!a || distanceKm(a, p.position) > NEAR_PLACE_KM) continue
    n++
    if (isClosure(e)) closures++
  }
  return { events: n, closures }
}

const store = storedList<SavedPlace>('qldt-saved-places')
export const useSavedPlaces = store.use
export const keepPlace = (p: SavedPlace) => store.write(savePlace(store.read(), p))
export const forgetPlace = (name: string) => store.write(removePlace(store.read(), name))
