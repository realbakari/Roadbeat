import type { WazeReport } from '../api/types'

// QLDTraffic's displayed_waze_events.json carries Waze's own report types:
// ACCIDENT, and HAZARD reports such as HAZARD_ON_ROAD_TRAFFIC_LIGHT_FAULT.
// A report is named by what it was published as, never assumed to be a crash.

const TYPES: Record<string, string> = { ACCIDENT: 'Crash', HAZARD: 'Hazard', JAM: 'Traffic jam', ROAD_CLOSED: 'Road closed' }

const SUBTYPES: Record<string, string> = {
  ACCIDENT_MINOR: 'Minor crash',
  ACCIDENT_MAJOR: 'Major crash',
  HAZARD_ON_ROAD: 'Hazard on road',
  HAZARD_ON_SHOULDER: 'Hazard on shoulder',
  HAZARD_WEATHER: 'Weather hazard',
}

const words = (s: string) => {
  const t = s.toLowerCase().replace(/_+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** "Traffic light fault" for HAZARD_ON_ROAD_TRAFFIC_LIGHT_FAULT, "Car stopped on shoulder" for HAZARD_ON_SHOULDER_CAR_STOPPED. */
export function wazeLabel(w: WazeReport): string {
  const sub = w.subtype?.trim()
  if (!sub) return TYPES[w.type] ?? words(w.type || 'Report')
  if (SUBTYPES[sub]) return SUBTYPES[sub]
  const rest = sub.startsWith(`${w.type}_`) ? sub.slice(w.type.length + 1) : sub
  const where = rest.match(/^ON_(ROAD|SHOULDER)_(.+)$/)
  if (where?.[1] === 'SHOULDER') return `${words(where[2])} on shoulder`
  return words(where ? where[2] : rest.replace(/^WEATHER_/, ''))
}

/** The map icon: a car for a crash, a warning sign for anything else. */
export const wazeIcon = (w: WazeReport) => (w.type === 'ACCIDENT' ? 'waze' : 'waze-hazard')
