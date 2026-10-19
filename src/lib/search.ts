import type { AirStation } from '../api/airQuality'
import type { CouncilEvent } from '../api/bccDashboard'
import type { AccessibleBay, BikeStop, ParkingMeter, Toilet } from '../api/bccPlaces'
import type { FireWarning } from '../api/bushfireFeed'
import type { Clearance } from '../api/clearances'
import { FUEL_STATUS_LABEL, type FuelStation } from '../api/fuelAvailability'
import type { Gauge } from '../api/gaugeTypes'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { QldWarning } from '../api/qldWarnings'
import { SPEED_CAMERA_LABEL, type SpeedCamera } from '../api/speedCameras'
import type { StopIndex } from '../api/stops'
import type { Camera, DumpPoint, RestArea, TrafficEvent, TransitLine, TruckRestriction } from '../api/types'
import { stopHref } from './departures'
import { eventPlace, eventTitle } from './eventText'
import { clean } from './format'
import { brandedName } from './fuelBrands'
import { cameraKey } from './geo'
import type { Locality } from './locality'
import type { NewsStory } from './newsStories'
import { lineSlug } from './transitLines'

// One search over everything the app has loaded, for the header. It matches
// each item's published name and place fields, whole words only, and opens
// the item at its own hash. Nothing is fetched to search it except the small
// lists the search itself needs (towns, train/tram/ferry stops, Translink's
// lines); a layer that isn't loaded is named under the results instead.

/** The groups a result is sorted into; among equally good matches, places people search for come first. */
export const SEARCH_KINDS = ['town', 'event', 'line', 'stop', 'camera', 'warning', 'fire', 'fuel', 'speedcamera', 'place', 'news', 'centre', 'outage', 'air', 'gauge'] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

/** Each group's heading in the results. */
export const KIND_LABEL: Record<SearchKind, string> = {
  town: 'Towns and suburbs',
  event: 'Road events',
  line: 'Translink lines',
  stop: 'Stations and stops',
  camera: 'Traffic and flood cameras',
  warning: 'Storm, flood and cyclone warnings',
  fire: 'Bushfires',
  fuel: 'Fuel at service stations',
  speedcamera: 'Speed and red light cameras',
  place: 'Places',
  news: 'News',
  centre: 'Council centres',
  outage: 'Outages',
  air: 'Air quality stations',
  gauge: 'Gauges',
}

export interface SearchHit {
  kind: SearchKind
  /** The item's published name. */
  title: string
  /** A short published line under the title: its type, place or publisher. */
  detail: string
  /** The app hash for the item, without the leading '#'. */
  href: string
}

/**
 * Everything the search can look through. A null list is one the app hasn't
 * loaded; the search says so rather than fetching it.
 */
export interface SearchSources {
  events: TrafficEvent[]
  cameras: Camera[]
  towns: Locality[] | null
  lines: TransitLine[] | null
  stops: StopIndex | null
  restAreas: RestArea[]
  dumpPoints: DumpPoint[]
  truckRestrictions: TruckRestriction[]
  clearances: Clearance[] | null
  toilets: Toilet[] | null
  bays: AccessibleBay[] | null
  meters: ParkingMeter[] | null
  bikeStops: BikeStop[] | null
  councilEvents: CouncilEvent[] | null
  stories: NewsStory[] | null
  centres: CouncilCentre[] | null
  outages: Outage[] | null
  airStations: AirStation[] | null
  gauges: Gauge[] | null
  fires: FireWarning[] | null
  warnings: QldWarning[] | null
  fuel: FuelStation[] | null
  speedCameras: SpeedCamera[] | null
}

/** The map layers whose data isn't loaded, by the name the layers panel gives them. */
export function unloadedLayers(s: SearchSources): string[] {
  const layers: [unknown, string][] = [
    [s.warnings, 'Storm, flood and cyclone warnings'],
    [s.fuel, 'Fuel at service stations'],
    [s.speedCameras, 'Speed and red light cameras'],
    [s.stories, 'News'],
    [s.centres, 'Council centres'],
    [s.outages, 'Outages'],
    [s.airStations, 'Air quality'],
    [s.gauges, 'Gauges'],
    [s.clearances, 'Low clearances'],
    [s.toilets, 'Public toilets'],
    [s.bays, 'Accessible parking'],
    [s.meters, 'Parking meters'],
    [s.bikeStops, 'Bikeways'],
    [s.councilEvents, 'Council events'],
  ]
  return layers.filter(([list]) => list == null).map(([, label]) => label)
}

/** Lower case, without accents, split into words of letters and digits. */
export function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Results per group, so one kind can't crowd out the rest. */
export const PER_KIND = 5
/** Queries shorter than this match too much to be useful. */
export const MIN_QUERY = 2

// Lower ranks sort first: a name that is the query, a name that begins with it,
// a name holding every query word whole, then prefixes of its words; then the
// same for an item matched only through its place (its suburb, council or
// district), so "Central" finds Central station before everything in the
// Central Highlands.
const EXACT = 0
const PREFIX = 1
const WORD = 2
const PARTIAL = 3
const PLACE_ONLY = 2

/** One searchable item, with its words worked out once when the index is built. */
export interface SearchEntry {
  hit: SearchHit
  name: string
  nameWords: string[]
  allWords: string[]
}

/**
 * How well an entry matches, or null for no match. Every query word must begin
 * a word of the name or of a place; a match inside a word doesn't count, so
 * "ora" doesn't find Toowoomba.
 */
function rank(query: string[], e: SearchEntry): number | null {
  let whole = true
  let inName = true
  for (const q of query) {
    if (!e.nameWords.some((w) => w.startsWith(q))) inName = false
    if (e.allWords.includes(q)) continue
    if (!e.allWords.some((w) => w.startsWith(q))) return null
    whole = false
  }
  const joinedQuery = query.join(' ')
  const joinedName = e.nameWords.join(' ')
  if (joinedName === joinedQuery) return EXACT
  if (joinedName.startsWith(joinedQuery)) return PREFIX
  return (whole ? WORD : PARTIAL) + (inName ? 0 : PLACE_ONLY)
}

const GAUGE_KIND: Record<Gauge['kind'], string> = { stream: 'Stream height gauge', rain: 'Rain gauge' }
const GAUGE_SOURCE: Record<Gauge['source'], string> = { bcc: 'Brisbane City Council', qld: 'Queensland Government' }
const MODE_LABEL: Record<TransitLine['mode'], string> = { train: 'Train line', bus: 'Bus route', ferry: 'Ferry route', tram: 'Tram line' }

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')

/** Every item the loaded data offers, with the published fields the search matches on. Build it once per load, not per keystroke. */
export function searchIndex(s: SearchSources): SearchEntry[] {
  const out: SearchEntry[] = []
  const add = (kind: SearchKind, title: string, detail: string, href: string, name: string, places: (string | null | undefined)[] = []) => {
    const nameWords = words(name)
    out.push({ hit: { kind, title, detail, href }, name, nameWords, allWords: [...nameWords, ...places.flatMap((p) => (p ? words(p) : []))] })
  }

  for (const t of s.towns ?? []) add('town', t.name, t.council ?? 'Queensland', `place/locality/${encodeURIComponent(t.name)}`, t.name, [t.council])
  for (const e of s.events) {
    const r = e.properties.road_summary
    add('event', eventTitle(e), join(e.properties.event_type, eventPlace(e)), `event/${e.properties.id}`, r?.road_name ?? '', [r?.locality, r?.local_government_area, r?.district])
  }
  for (const l of s.lines ?? []) add('line', l.name, join(MODE_LABEL[l.mode], l.status && `Status: ${l.status}`), `transit/line/${lineSlug(l)}`, l.name)
  if (s.stops) {
    for (const st of s.stops.all()) {
      // Platforms are reached through their station.
      if (st.parent) continue
      add('stop', st.name, s.stops.children(st).length > 0 ? 'Station' : 'Stop', stopHref(st.region, st.id), st.name)
    }
  }
  for (const c of s.cameras) {
    add('camera', c.properties.description, join(c.kind === 'floodcam' ? 'Flood camera' : 'Traffic camera', clean(c.properties.locality), c.council ?? clean(c.properties.district)), `camera/${cameraKey(c)}`, c.properties.description, [
      c.properties.locality,
      c.properties.district,
    ])
  }
  for (const w of s.warnings ?? []) add('warning', w.area ?? w.title, join(w.levelText, w.type, w.from), `place/warning/${encodeURIComponent(w.id)}`, w.area ?? w.title, [w.from])
  for (const f of s.fires ?? []) add('fire', f.title, join(f.levelText, f.area), `fire/${encodeURIComponent(f.id)}`, f.title, [f.area, f.location])
  for (const f of s.fuel ?? []) add('fuel', brandedName(f), join(FUEL_STATUS_LABEL[f.status], f.address), `place/fuel/${encodeURIComponent(f.id)}`, brandedName(f), [f.address, f.council])
  for (const c of s.speedCameras ?? []) add('speedcamera', c.site, SPEED_CAMERA_LABEL[c.type], `place/speedcamera/${encodeURIComponent(c.id)}`, c.site)
  for (const r of s.restAreas) if (r.name) add('place', r.name, 'Rest area', `place/rest/${r.id}`, r.name)
  for (const d of s.dumpPoints) add('place', d.name, 'RV dump point', `place/dump/${d.id}`, d.name)
  for (const t of s.truckRestrictions) add('place', t.properties.name, 'Heavy vehicle restriction', `place/truck/${t.properties.id}`, t.properties.name, [t.properties.suburbs])
  for (const c of s.clearances ?? []) add('place', c.title, join('Low clearance', c.suburb), `place/clearance/${c.id}`, c.title, [c.suburb])
  for (const t of s.toilets ?? []) add('place', t.name, join('Public toilet', t.address), `place/toilet/${t.id}`, t.name, [t.address])
  for (const b of s.bays ?? []) if (b.street) add('place', b.street, join('Accessible parking', b.suburb), `place/bay/${b.id}`, b.street, [b.suburb])
  for (const m of s.meters ?? []) if (m.street) add('place', m.street, join('Parking meter', m.suburb), `place/meter/${m.id}`, m.street, [m.suburb])
  for (const b of s.bikeStops ?? []) add('place', b.name, join(b.kind === 'repair' ? 'Bike repair station' : 'Bike rack', b.suburb), `place/bike/${b.id}`, b.name, [b.suburb])
  for (const e of s.councilEvents ?? []) add('place', e.title, join('Council event', e.venue), `place/event/${e.id}`, e.title, [e.venue, e.address])
  for (const story of s.stories ?? []) {
    const headline = story.items[0]?.title
    if (headline) add('news', headline, story.publishers.join(', '), `news/${story.id}`, headline, [...story.places.map((p) => p.name), ...story.roads.flatMap((r) => [r.name, r.locality])])
  }
  for (const c of s.centres ?? []) add('centre', c.name, join(c.type, c.council), `place/centre/${c.id}`, c.name, [c.address, c.council])
  for (const o of s.outages ?? []) add('outage', o.title, o.source === 'energex' ? `${o.type} outage · Energex` : join(o.type, o.council), `place/outage/${o.id}`, o.title, [o.place?.name, ...o.streets, o.council])
  for (const a of s.airStations ?? []) add('air', a.name, join('Air quality station', a.region), `place/air/${a.id}`, a.name, [a.region])
  for (const g of s.gauges ?? []) add('gauge', g.name, join(GAUGE_KIND[g.kind], GAUGE_SOURCE[g.source]), `gauge/${encodeURIComponent(g.id)}`, g.name)
  return out
}

/**
 * The entries the query names, best first and at most PER_KIND of each kind.
 * Matching is on whole words, case-insensitively: every query word must be, or
 * begin, a word of the entry's name or place. Ranked exact name first, then
 * names beginning with the query, then whole-word matches, then prefixes;
 * ties go to the shorter name.
 */
export function searchIn(index: SearchEntry[], query: string): SearchHit[] {
  const q = words(query)
  if (!q.length || q.join('').length < MIN_QUERY) return []
  const ranked: { hit: SearchHit; rank: number }[] = []
  for (const e of index) {
    const r = rank(q, e)
    if (r != null) ranked.push({ hit: e.hit, rank: r })
  }
  const kindOrder = (k: SearchKind) => SEARCH_KINDS.indexOf(k)
  ranked.sort((a, b) => a.rank - b.rank || kindOrder(a.hit.kind) - kindOrder(b.hit.kind) || a.hit.title.length - b.hit.title.length || a.hit.title.localeCompare(b.hit.title))
  const seen = new Set<string>()
  const perKind = new Map<SearchKind, number>()
  const hits: SearchHit[] = []
  for (const { hit } of ranked) {
    if (seen.has(hit.href)) continue
    const n = perKind.get(hit.kind) ?? 0
    if (n >= PER_KIND) continue
    seen.add(hit.href)
    perKind.set(hit.kind, n + 1)
    hits.push(hit)
  }
  return hits
}

/** The search in one call, for tests and one-off lookups. */
export const search = (sources: SearchSources, query: string) => searchIn(searchIndex(sources), query)

/** Hits grouped by kind, the group with the best hit first (searchIn returns them best first), keeping each group's ranking. */
export function groupHits(hits: SearchHit[]): { kind: SearchKind; hits: SearchHit[] }[] {
  const kinds = [...new Set(hits.map((h) => h.kind))]
  return kinds.map((kind) => ({ kind, hits: hits.filter((h) => h.kind === kind) }))
}
