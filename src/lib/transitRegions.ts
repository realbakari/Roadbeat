import { TRANSIT_REGIONS, type TransitRegion } from '../api/transitTypes.js'

/** Each feed's network, as data.qld.gov.au names its GTFS file. */
export const REGION_NAMES: Record<TransitRegion, string> = {
  SEQ: 'South East Queensland',
  CNS: 'Cairns',
  NSI: 'North Stradbroke Island',
  MHB: 'Maryborough–Hervey Bay',
  BOW: 'Bowen',
  INN: 'Innisfail',
  TSV: 'Townsville',
  MKY: 'Mackay',
  BUN: 'Bundaberg',
  GLT: 'Gladstone',
  GYM: 'Gympie',
  KIL: 'Kilcoy',
  MAG: 'Magnetic Island',
  MIF: 'Magnetic Island ferry',
  MAL: 'Maleny–Landsborough',
  RKY: 'Rockhampton–Yeppoon',
  TWB: 'Toowoomba',
  WAR: 'Warwick',
  WHT: 'Whitsundays',
}

/** Regions whose real-time feeds are read on every poll: they carry services all day. */
export const MAIN_REGIONS: readonly TransitRegion[] = ['SEQ', 'CNS']

/**
 * The other regions with a GTFS-RT endpoint. Translink answers all of them,
 * but on 16 Oct 2026 only North Stradbroke Island's listed any trips; the rest
 * sent empty feeds. Magnetic Island ferry (MIF) has no endpoint (404).
 */
export const PROBED_REGIONS: readonly TransitRegion[] = TRANSIT_REGIONS.filter((r) => !MAIN_REGIONS.includes(r) && r !== 'MIF')

/** Trips each probed region's TripUpdates feed listed when last read; a region not read yet is absent. */
export type FeedCounts = Partial<Record<TransitRegion, number>>

/** Regions to read real-time feeds for: SEQ and Cairns always, any other while its last read listed a trip. */
export function liveRegions(counts: FeedCounts): TransitRegion[] {
  return [...MAIN_REGIONS, ...PROBED_REGIONS.filter((r) => (counts[r] ?? 0) > 0)]
}

/**
 * What a region's pages can show: 'live' when its real-time feed is read,
 * 'timetable' when Translink publishes no real-time feed for it or its feed
 * listed no trips when last read, 'checking' before the first read.
 */
export type RealtimeState = 'live' | 'timetable' | 'checking'

export function realtimeState(region: TransitRegion, counts: FeedCounts): RealtimeState {
  if (MAIN_REGIONS.includes(region)) return 'live'
  if (!PROBED_REGIONS.includes(region)) return 'timetable'
  const n = counts[region]
  return n == null ? 'checking' : n > 0 ? 'live' : 'timetable'
}
