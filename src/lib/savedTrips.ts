import type { TransitRegion } from '../api/translink'
import type { Journey } from './planner'

// "My trips", as in TripView: saved from → to pairs, each shown with its next
// departures from the published timetable. The list itself is kept in this
// browser by savedStops.ts; these functions only change and read it.

export const TRIP_MODES = ['train', 'bus', 'ferry', 'tram'] as const
export type TripMode = (typeof TRIP_MODES)[number]

/** A journey a rider has saved ("My trips"), re-planned from now when opened. */
export interface SavedTrip {
  region: TransitRegion
  from: string
  to: string
  /** The rider's own name for it, or none to show the stop names. */
  name?: string
  /** Modes the planner may use; none saved means every mode. */
  modes?: TripMode[]
  /** Only direct services, no change. */
  direct?: boolean
}

/** Two saved trips are the same trip when they join the same stops. */
export const sameTrip = (a: SavedTrip, b: SavedTrip) => a.region === b.region && a.from === b.from && a.to === b.to

/** Adds a trip, or replaces the saved one between the same stops in place (keeping its name). */
export function saveTrip(list: SavedTrip[], t: SavedTrip): SavedTrip[] {
  const i = list.findIndex((x) => sameTrip(x, t))
  if (i < 0) return [...list, t]
  return list.map((x, k) => (k === i ? { ...t, name: t.name ?? x.name } : x))
}

export function removeTrip(list: SavedTrip[], t: SavedTrip): SavedTrip[] {
  return list.filter((x) => !sameTrip(x, t))
}

/** Renames a trip; a blank name goes back to the stop names. */
export function renameTrip(list: SavedTrip[], t: SavedTrip, name: string): SavedTrip[] {
  const n = name.trim()
  return list.map((x) => {
    if (!sameTrip(x, t)) return x
    const out: SavedTrip = { ...x, name: n }
    if (!n) delete out.name
    return out
  })
}

/** Moves a trip `by` places up (negative) or down the list, stopping at either end. */
export function moveTrip(list: SavedTrip[], t: SavedTrip, by: number): SavedTrip[] {
  const i = list.findIndex((x) => sameTrip(x, t))
  if (i < 0) return list
  const j = Math.max(0, Math.min(list.length - 1, i + by))
  if (i === j) return list
  const out = [...list]
  out.splice(j, 0, ...out.splice(i, 1))
  return out
}

/** The planner's filters as saved with a trip: every mode and any number of changes saves nothing. */
export function tripFilter(modes: Iterable<string>, direct: boolean): Pick<SavedTrip, 'modes' | 'direct'> {
  const set = new Set(modes)
  const chosen = TRIP_MODES.filter((m) => set.has(m))
  return {
    ...(chosen.length < TRIP_MODES.length ? { modes: chosen } : {}),
    ...(direct ? { direct: true } : {}),
  }
}

/** Journeys the filters allow: only the chosen modes on every ride, and only direct ones when asked. */
export function filterJourneys(
  journeys: Journey[],
  filter: { modes?: readonly string[] | null; direct?: boolean },
  modeOf: (leg: Journey['legs'][number]) => string,
): Journey[] {
  const modes = filter.modes?.length ? new Set(filter.modes) : null
  return journeys.filter((j) => (!filter.direct || j.legs.length === 1) && (!modes || j.legs.every((l) => modes.has(modeOf(l)))))
}

/**
 * The next `n` journeys that have not left. A journey counts as gone once both
 * its published departure and the departure TransLink reports (when it reports
 * one) are behind `now`, so a late service stays listed until it actually leaves.
 */
export function nextJourneys(journeys: Journey[], now: number, n: number, reported: (j: Journey) => number | null): Journey[] {
  const out: Journey[] = []
  for (const j of journeys) {
    if (Math.max(j.dep, reported(j) ?? 0) < now) continue
    out.push(j)
    if (out.length === n) break
  }
  return out
}
