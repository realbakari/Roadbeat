import type { AirStation } from '../api/airQuality'
import type { CouncilEvent } from '../api/bccDashboard'
import type { AccessibleBay, BikeStop, ParkingMeter, Toilet } from '../api/bccPlaces'
import type { FireWarning } from '../api/bushfireFeed'
import type { Clearance } from '../api/clearances'
import type { Gauge } from '../api/gaugeTypes'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { StopIndex } from '../api/stops'
import type { Camera, DumpPoint, RestArea, TrafficEvent, TruckRestriction } from '../api/types'
import { stopHref } from './departures'
import { eventPlace, eventTitle } from './eventText'
import { clean } from './format'
import { cameraKey } from './geo'
import type { NewsStory } from './newsStories'

/** The groups a search result is sorted into, in the order they are shown. */
export type SearchKind = 'event' | 'camera' | 'stop' | 'place' | 'news' | 'centre' | 'outage' | 'air' | 'gauge' | 'fire'

export const SEARCH_KINDS: SearchKind[] = ['event', 'camera', 'stop', 'place', 'news', 'centre', 'outage', 'air', 'gauge', 'fire']

/** Each group's heading in the results. */
export const KIND_LABEL: Record<SearchKind, string> = {
  event: 'Road events',
  camera: 'Cameras',
  stop: 'Stations and stops',
  place: 'Places',
  news: 'News',
  centre: 'Council centres',
  outage: 'Outages',
  air: 'Air quality stations',
  gauge: 'Gauges',
  fire: 'Bushfires',
}

export interface SearchHit {
  kind: SearchKind
  /** The item's published name. */
  title: string
  /** A short published line under the title: its type, locality or publisher. */
  detail: string
  /** The app hash for the item, without the leading '#'. */
  href: string
}

/**
 * Everything the search can look through. A null list is a layer the app has
 * not loaded; the search says so rather than fetching it.
 */
export interface SearchSources {
  events: TrafficEvent[]
  cameras: Camera[]
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
}

/** The map layers whose data is not loaded, by the name the layers panel gives them. */
export function unloadedLayers(s: SearchSources): string[] {
  const layers: [unknown, string][] = [
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

/** Results per group, so one kind cannot crowd out the rest. */
export const PER_KIND = 5
/** Queries shorter than this match too much to be useful. */
export const MIN_QUERY = 2

// Lower ranks sort first: a name that is the query, a name that begins with it,
// a name or locality holding every query word whole, then prefixes of words.
const EXACT = 0
const PREFIX = 1
const WORD = 2
const PARTIAL = 3

/**
 * How well an item matches, or null for no match. Every query word must begin
 * a word of the name or of a locality; a match within a word does not count,
 * so "ora" does not find Toowoomba.
 */
function rank(query: string[], name: string, localities: (string | null | undefined)[]): number | null {
  const nameWords = words(name)
  const localityWords = localities.flatMap((l) => (l ? words(l) : []))
  const all = [...nameWords, ...localityWords]
  let whole = true
  for (const q of query) {
    if (all.includes(q)) continue
    if (!all.some((w) => w.startsWith(q))) return null
    whole = false
  }
  const joinedQuery = query.join(' ')
  const joinedName = nameWords.join(' ')
  if (joinedName === joinedQuery) return EXACT
  if (joinedName.startsWith(joinedQuery)) return PREFIX
  return whole ? WORD : PARTIAL
}

interface Candidate {
  hit: SearchHit
  name: string
  localities: (string | null | undefined)[]
}

function cameraDetail(c: Camera): string {
  const kind = c.kind === 'floodcam' ? 'Flood camera' : 'Traffic camera'
  return [kind, clean(c.properties.locality), c.council ?? clean(c.properties.district)].filter(Boolean).join(' · ')
}

const GAUGE_KIND: Record<Gauge['kind'], string> = { stream: 'Stream height gauge', rain: 'Rain gauge' }
const GAUGE_SOURCE: Record<Gauge['source'], string> = { bcc: 'Brisbane City Council', qld: 'Queensland Government' }

/** Every item the loaded data offers, with the published fields the search matches on. */
function candidates(s: SearchSources): Candidate[] {
  const out: Candidate[] = []
  const add = (kind: SearchKind, title: string, detail: string, href: string, name: string, localities: (string | null | undefined)[] = []) =>
    out.push({ hit: { kind, title, detail, href }, name, localities })

  for (const e of s.events) {
    const r = e.properties.road_summary
    add('event', eventTitle(e), [e.properties.event_type, eventPlace(e)].filter(Boolean).join(' · '), `event/${e.properties.id}`, r?.road_name ?? '', [
      r?.locality,
      r?.local_government_area,
      r?.district,
    ])
  }
  for (const c of s.cameras) {
    add('camera', c.properties.description, cameraDetail(c), `camera/${cameraKey(c)}`, c.properties.description, [c.properties.locality, c.properties.district])
  }
  if (s.stops) {
    for (const st of s.stops.all()) {
      // Platforms are reached through their station.
      if (st.parent) continue
      const station = s.stops.children(st).length > 0
      add('stop', st.name, station ? 'Station' : 'Stop', stopHref(st.region, st.id), st.name)
    }
  }
  for (const r of s.restAreas) if (r.name) add('place', r.name, 'Rest area', `place/rest/${r.id}`, r.name)
  for (const d of s.dumpPoints) add('place', d.name, 'RV dump point', `place/dump/${d.id}`, d.name)
  for (const t of s.truckRestrictions) {
    const p = t.properties
    add('place', p.name, 'Heavy vehicle restriction', `place/truck/${p.id}`, p.name, [p.suburbs])
  }
  for (const c of s.clearances ?? []) add('place', c.title, ['Low clearance', c.suburb].filter(Boolean).join(' · '), `place/clearance/${c.id}`, c.title, [c.suburb])
  for (const t of s.toilets ?? []) add('place', t.name, ['Public toilet', t.address].filter(Boolean).join(' · '), `place/toilet/${t.id}`, t.name, [t.address])
  for (const b of s.bays ?? []) if (b.street) add('place', b.street, ['Accessible parking', b.suburb].filter(Boolean).join(' · '), `place/bay/${b.id}`, b.street, [b.suburb])
  for (const m of s.meters ?? []) if (m.street) add('place', m.street, ['Parking meter', m.suburb].filter(Boolean).join(' · '), `place/meter/${m.id}`, m.street, [m.suburb])
  for (const b of s.bikeStops ?? []) {
    add('place', b.name, [b.kind === 'repair' ? 'Bike repair station' : 'Bike rack', b.suburb].filter(Boolean).join(' · '), `place/bike/${b.id}`, b.name, [b.suburb])
  }
  for (const e of s.councilEvents ?? []) add('place', e.title, ['Council event', e.venue].filter(Boolean).join(' · '), `place/event/${e.id}`, e.title, [e.venue, e.address])
  for (const story of s.stories ?? []) {
    const headline = story.items[0]?.title
    if (!headline) continue
    add('news', headline, story.publishers.join(', '), `news/${story.id}`, headline, [
      ...story.places.map((p) => p.name),
      ...story.roads.flatMap((r) => [r.name, r.locality]),
    ])
  }
  for (const c of s.centres ?? []) add('centre', c.name, `${c.type} · ${c.council}`, `place/centre/${c.id}`, c.name, [c.address, c.council])
  for (const o of s.outages ?? []) {
    const detail = o.source === 'energex' ? `${o.type} outage · Energex` : `${o.type} · ${o.council}`
    add('outage', o.title, detail, `place/outage/${o.id}`, o.title, [o.place?.name, ...o.streets, o.council])
  }
  for (const a of s.airStations ?? []) add('air', a.name, `Air quality station · ${a.region}`, `place/air/${a.id}`, a.name, [a.region])
  for (const g of s.gauges ?? []) add('gauge', g.name, `${GAUGE_KIND[g.kind]} · ${GAUGE_SOURCE[g.source]}`, `gauge/${encodeURIComponent(g.id)}`, g.name)
  for (const f of s.fires ?? []) add('fire', f.title, [f.levelText, f.area].filter(Boolean).join(' · '), `fire/${encodeURIComponent(f.id)}`, f.title, [f.area, f.location])
  return out
}

/**
 * The items whose published name or locality the query names, best first and
 * at most PER_KIND of each kind. Matching is on whole words, case-insensitively:
 * every query word must be, or begin, a word of the item's name or locality.
 * Items are ranked exact name first, then names beginning with the query, then
 * whole-word matches, then prefixes; ties go to the shorter name.
 */
export function search(sources: SearchSources, query: string): SearchHit[] {
  const q = words(query)
  if (!q.length || q.join('').length < MIN_QUERY) return []
  const ranked: { hit: SearchHit; rank: number }[] = []
  for (const c of candidates(sources)) {
    const r = rank(q, c.name, c.localities)
    if (r != null) ranked.push({ hit: c.hit, rank: r })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.hit.title.length - b.hit.title.length || a.hit.title.localeCompare(b.hit.title))
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

/** Hits grouped by kind, in SEARCH_KINDS order, keeping each group's ranking. */
export function groupHits(hits: SearchHit[]): { kind: SearchKind; hits: SearchHit[] }[] {
  return SEARCH_KINDS.map((kind) => ({ kind, hits: hits.filter((h) => h.kind === kind) })).filter((g) => g.hits.length)
}
