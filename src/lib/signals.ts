import type { ApproachReading } from '../api/bccSignals'

/** A site's latest cycle at a glance: its busiest lane and the vehicles counted across all lanes. */
export function siteLoad(approaches: ApproachReading[]) {
  let maxDs = 0
  let vehicles = 0
  let recorded = 0
  for (const a of approaches) {
    recorded = Math.max(recorded, a.recorded)
    for (const l of a.lanes) {
      maxDs = Math.max(maxDs, l.ds)
      vehicles += l.vehicles
    }
  }
  return { maxDs, vehicles, recorded }
}

/** A site has visibly changed between batches when its busiest lane moves this many points or into another band. */
const CHANGE_POINTS = 10

/** Whether the busiest lane's saturation changed enough between two batches to point out. */
export function loadChanged(before: number, after: number) {
  return Math.abs(after - before) >= CHANGE_POINTS || dsBand(before) !== dsBand(after)
}

/** Saturation bands, lowest first: from this % upwards, this colour. */
export const DS_BANDS: readonly (readonly [number, string])[] = [
  [0, '#16a34a'],
  [50, '#ca8a04'],
  [80, '#ea580c'],
  [100, '#dc2626'],
]

/** Index into `DS_BANDS` for a degree of saturation. */
export function dsBand(ds: number) {
  for (let i = DS_BANDS.length - 1; i > 0; i--) if (ds >= DS_BANDS[i][0]) return i
  return 0
}

/** Colour for a degree of saturation: green when lanes are mostly free, through amber, to red at 100 % and over. */
export function dsColor(ds: number) {
  return DS_BANDS[dsBand(ds)][1]
}
