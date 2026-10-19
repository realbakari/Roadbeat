// Types for Translink's GTFS-RT feeds, shared by the app and the server functions in api/.
// Kept free of imports so server code can import them directly.

/**
 * Translink's GTFS feeds, by the region code in their URLs: South East
 * Queensland and every regional network on data.qld.gov.au. Keep in step with
 * scripts/lib/gtfs.mjs.
 */
export const TRANSIT_REGIONS = ['SEQ', 'CNS', 'NSI', 'MHB', 'BOW', 'INN', 'TSV', 'MKY', 'BUN', 'GLT', 'GYM', 'KIL', 'MAG', 'MIF', 'MAL', 'RKY', 'TWB', 'WAR', 'WHT'] as const
export type TransitRegion = (typeof TRANSIT_REGIONS)[number]

export function isTransitRegion(s: string | undefined): s is TransitRegion {
  return (TRANSIT_REGIONS as readonly (string | undefined)[]).includes(s)
}
export type VehicleMode = 'bus' | 'train' | 'tram' | 'ferry'

export interface LiveVehicle {
  id: string
  region: TransitRegion
  mode: VehicleMode
  /** Route code from the feed: "402", "F1", "L1", or a train code like "BRCA". */
  route: string
  routeId: string
  /** GTFS trip id the vehicle reports it is running, if any. */
  tripId: string | null
  /** Official T-line for trains ("T1 Caboolture"), else null. */
  lineName: string | null
  /** Official route name from Translink ("Brisbane City - Caboolture", "Toowong - University of Qld"). */
  routeName: string | null
  color: string | null
  label: string | null
  position: [number, number]
  bearing: number | null
  status: 'stopped' | 'arriving' | 'moving' | null
  stopId: string | null
  timestamp: number
}

/** One stop on a trip as Translink's real-time feed reports it. */
export interface StopTime {
  stopId: string
  sequence: number | null
  /** Reported departure time (ms), or arrival time when only arrival is given. */
  time: number | null
  /** True when only an arrival is reported (e.g. the trip ends here). */
  arrivalOnly: boolean
  /** Reported delay in seconds against the timetable (negative = early), or null. */
  delay: number | null
  skipped: boolean
}

export interface TripUpdate {
  key: string
  region: TransitRegion
  tripId: string
  route: string
  routeId: string
  relationship: 'scheduled' | 'added' | 'unscheduled' | 'cancelled' | 'replacement' | 'duplicated'
  /** Remaining stops in order, as listed in the feed. */
  stops: StopTime[]
}

export interface TripUpdates {
  /** Feed timestamps (ms) by region. */
  at: Partial<Record<TransitRegion, number>>
  trips: TripUpdate[]
}
