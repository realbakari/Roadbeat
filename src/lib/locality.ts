import type { AirStation } from '../api/airQuality'
import type { FireWarning } from '../api/bushfireFeed'
import type { Gauge } from '../api/gaugeTypes'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { Camera, TrafficEvent } from '../api/types'
import { distanceKm, type LngLat } from './geo'
import { eventAtPlaces, fireNamesPlace, placePattern } from './newsOfficial'
import type { NewsStory } from './newsStories'

/** A town, suburb or locality in Queensland's place names gazetteer, at the gazetteer's own point. */
export interface Locality {
  name: string
  /** The council area the gazetteer files it under, such as "Ipswich City". */
  council: string
  position: LngLat
}

/** How far from a locality's gazetteer point a positioned source counts as there. */
export const NEAR_KM = 5

/** The locality with this name, exactly first, else ignoring case; null when the gazetteer has none. */
export function findLocality(list: Locality[], name: string): Locality | null {
  const exact = list.find((l) => l.name === name)
  if (exact) return exact
  const lower = name.toLowerCase()
  return list.find((l) => l.name.toLowerCase() === lower) ?? null
}

/** The locality whose gazetteer point is nearest a point, within `km`; null when none is that close. */
export function nearestLocality(list: Locality[], at: LngLat, km: number): { locality: Locality; km: number } | null {
  let best: { locality: Locality; km: number } | null = null
  for (const locality of list) {
    const d = distanceKm(at, locality.position)
    if (d <= km && (!best || d < best.km)) best = { locality, km: d }
  }
  return best
}

/** The loaded data a locality page gathers from; null for a source that is not loaded. */
export interface LocalitySources {
  events: TrafficEvent[]
  fires: FireWarning[] | null
  /** QLDTraffic's cameras and any council cameras that have joined them. */
  cameras: Camera[]
  airStations: AirStation[] | null
  centres: CouncilCentre[] | null
  outages: Outage[] | null
  stories: NewsStory[] | null
  gauges: Gauge[] | null
  /** Why a source's data isn't loaded, for one whose read failed rather than one turned off. */
  errors?: Partial<Record<LocalitySource, string>>
}

/** A source matched by position, with its distance from the locality's point. */
export interface Near<T> {
  item: T
  km: number
}

/** The sources a locality page can list, each absent from the page when its data is not loaded. */
export type LocalitySource = 'fires' | 'airStations' | 'centres' | 'outages' | 'stories' | 'gauges'

/** Everything the loaded sources publish at a locality. */
export interface LocalityReport {
  /** Road events in effect whose QLDTraffic locality is this one. */
  events: TrafficEvent[]
  /** QFD warnings and incidents whose area, title or location names it. */
  fires: FireWarning[]
  /** Cameras QLDTraffic or a council files under this locality, or within NEAR_KM of its point; nearest first. */
  cameras: Near<Camera>[]
  airStations: Near<AirStation>[]
  centres: Near<CouncilCentre>[]
  /** Energex outages whose suburb is this locality. Council notices name no suburb, so they are never listed. */
  outages: Outage[]
  /** Stories whose headline or summary names it. */
  stories: NewsStory[]
  gauges: Near<Gauge>[]
  /** Sources whose data is not loaded, so the page cannot say what they publish here. */
  notLoaded: LocalitySource[]
  /** Sources whose read failed, with the error, so the page cannot say what they publish here either. */
  failed: { source: LocalitySource; error: string }[]
}

const sameName = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.toLowerCase()

function within<T>(items: T[], at: LngLat, position: (t: T) => LngLat, km: number, orNamed?: (t: T) => boolean): Near<T>[] {
  return items
    .map((item) => ({ item, km: distanceKm(at, position(item)) }))
    .filter((n) => n.km <= km || orNamed?.(n.item))
    .sort((a, b) => a.km - b.km)
}

/**
 * What the loaded sources publish at a locality. Every match is by the source's
 * own published name or position: QLDTraffic's locality field, QFD's area text,
 * Energex's suburb, a story's gazetteer places, or a published point within
 * NEAR_KM of the gazetteer's point for the name. Nothing is inferred, so a
 * source that names the place differently (a camera filed under a neighbouring
 * suburb, beyond NEAR_KM) is not listed.
 */
export function atLocality(locality: Locality, s: LocalitySources, now: number): LocalityReport {
  const names = new Set([locality.name.toLowerCase()])
  const named = placePattern([locality.name])
  const at = locality.position
  const notLoaded: LocalitySource[] = []
  const failed: LocalityReport['failed'] = []
  const loaded = <T,>(key: LocalitySource, list: T[] | null): T[] => {
    if (list) return list
    const error = s.errors?.[key]
    if (error) failed.push({ source: key, error })
    else notLoaded.push(key)
    return []
  }
  return {
    events: s.events.filter((e) => eventAtPlaces(e, names, now)),
    fires: loaded('fires', s.fires).filter((f) => fireNamesPlace(f, named)),
    cameras: within(s.cameras, at, (c) => c.geometry.coordinates as LngLat, NEAR_KM, (c) => sameName(c.properties.locality, locality.name)),
    airStations: within(loaded('airStations', s.airStations), at, (a) => a.position, NEAR_KM),
    centres: within(loaded('centres', s.centres), at, (c) => c.position, NEAR_KM),
    outages: loaded('outages', s.outages).filter((o) => o.place != null && sameName(o.place.name, locality.name)),
    stories: loaded('stories', s.stories).filter((st) => st.places.some((p) => p.via === 'gazetteer' && p.name === locality.name)),
    gauges: within(loaded('gauges', s.gauges), at, (g) => g.position, NEAR_KM),
    notLoaded,
    failed,
  }
}

/** How many items a report lists, across every source. */
export function reportCount(r: LocalityReport): number {
  return r.events.length + r.fires.length + r.cameras.length + r.airStations.length + r.centres.length + r.outages.length + r.stories.length + r.gauges.length
}
