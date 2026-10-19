import type { Camera, TrafficEvent } from '../api/types.js'
import { distanceKm, type LngLat } from './distance.js'
import { eventBounds, flatten, positions, type Bounds } from './eventAnchor.js'
import { isClosure, isCurrent } from './eventStatus.js'

// What QLDTraffic lists at each of its flood cameras, which it places at
// crossings and roads that flood. Roadbeat doesn't judge whether a crossing is
// passable: it says which current events QLDTraffic places within CROSSING_KM
// of the camera, by the event's own published points.

/** How close an event's published geometry must come to a flood camera to count as at its crossing. */
export const CROSSING_KM = 1

export interface CrossingStatus {
  /** Current road closures QLDTraffic places at the crossing. */
  closures: TrafficEvent[]
  /** Current flooding events there that aren't closures. */
  flooding: TrafficEvent[]
}

function nearestKm(at: LngLat, e: TrafficEvent): number {
  let best = Infinity
  for (const g of flatten(e.geometry)) for (const [lng, lat] of positions(g)) best = Math.min(best, distanceKm(at, [lng, lat]))
  return best
}

/** Degrees of latitude in CROSSING_KM, with room to spare, for a quick box check before measuring. */
const MARGIN_DEG = (CROSSING_KM / 111) * 1.5

const relevant = (e: TrafficEvent, now: number) => isCurrent(e, now) && (isClosure(e) || e.properties.event_type === 'Flooding')

function statusAt(at: LngLat, candidates: { e: TrafficEvent; box: Bounds | null }[]): CrossingStatus {
  // A degree of longitude shrinks towards the poles; widen the box to match.
  const lngMargin = MARGIN_DEG / Math.cos((at[1] * Math.PI) / 180)
  const near = candidates
    .filter(({ box }) => box && at[0] >= box[0][0] - lngMargin && at[0] <= box[1][0] + lngMargin && at[1] >= box[0][1] - MARGIN_DEG && at[1] <= box[1][1] + MARGIN_DEG)
    .map(({ e }) => e)
    .filter((e) => nearestKm(at, e) <= CROSSING_KM)
  return { closures: near.filter(isClosure), flooding: near.filter((e) => !isClosure(e)) }
}

/** The current closures and flooding QLDTraffic places within CROSSING_KM of a flood camera. */
export function crossingStatus(camera: Camera, events: TrafficEvent[], now: number): CrossingStatus {
  const [lng, lat] = camera.geometry.coordinates
  return statusAt([lng, lat], events.filter((e) => relevant(e, now)).map((e) => ({ e, box: eventBounds(e) })))
}

/** crossingStatus for every flood camera in a list, keyed by `key`, sharing one pass over the events. */
export function crossingStatuses(cameras: Camera[], events: TrafficEvent[], now: number, key: (c: Camera) => string): Map<string, CrossingStatus> {
  const candidates = events.filter((e) => relevant(e, now)).map((e) => ({ e, box: eventBounds(e) }))
  const out = new Map<string, CrossingStatus>()
  for (const c of cameras) {
    if (c.kind !== 'floodcam') continue
    const [lng, lat] = c.geometry.coordinates
    out.set(key(c), statusAt([lng, lat], candidates))
  }
  return out
}

/** The camera's note in words: what's listed, or that nothing is. Never "open" or "clear". */
export function crossingNote(s: CrossingStatus): string {
  if (s.closures.length) return `Road closed within ${CROSSING_KM} km`
  if (s.flooding.length) return `Flooding listed within ${CROSSING_KM} km`
  return `Nothing listed within ${CROSSING_KM} km`
}
