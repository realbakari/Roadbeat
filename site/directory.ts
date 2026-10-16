// The static directory's model: every train station, tram stop and ferry
// terminal, every TransLink line and regional route, and every gazetteer
// locality, built from the published data already in the repo. Nothing here
// is live or estimated: names, codes and coordinates are TransLink's and the
// Department of Resources' own, and a line's stops come from the compact
// timetable index (public/timetables/index.json), not the timetable files.
// site/directoryPages.ts turns this model into pages.
import { readFileSync } from 'node:fs'
import { TRANSIT_REGIONS, type TransitRegion, type VehicleMode } from '../src/api/transitTypes.ts'
import { REGION_NAMES } from '../src/lib/transitRegions.ts'

type StopRow = [id: string, name: string, lat: number, lng: number, parent: string | 0, platform: string | 0]
export interface StopFile {
  stops: Partial<Record<TransitRegion, StopRow[]>>
}
export interface RouteFile {
  routes: Record<string, { short: string; long: string; mode: VehicleMode; url?: string; line?: string }>
}
/** The compact timetable index scripts/build-timetables.mjs writes (see src/api/timetables.ts). */
export interface TimetableIndex {
  regions: Partial<Record<TransitRegion, { routes: string[]; stops: Record<string, string> }>>
}
export interface PlaceFile {
  places: [name: string, lng: number, lat: number, council: string][]
}

export interface DirectoryInput {
  /** Train, tram and ferry stops: the stations the directory has pages for. */
  core: StopFile
  /** Every other stop, for naming the stops a route serves. */
  others: StopFile[]
  routes: RouteFile
  index: TimetableIndex
  places: PlaceFile
}

export type LngLat = [lng: number, lat: number]

export interface Station {
  slug: string
  id: string
  region: TransitRegion
  name: string
  mode: VehicleMode
  position: LngLat
  /** Official platform codes, in order. */
  platforms: string[]
  /** Slugs of the lines and routes that call here, in the directory's order. */
  lines: string[]
  /** The nearest localities within NEAR_KM of the station, nearest first, at most NEARBY_PLACES. */
  places: Near[]
}

export interface Line {
  slug: string
  region: TransitRegion
  mode: VehicleMode
  /** Rider-facing name: "T1 Caboolture", "F1", "200". */
  name: string
  /** Official route name(s): "Brisbane City - Caboolture". */
  long: string
  /** GTFS route codes the page covers. */
  codes: string[]
  /** The app view for it: #transit/line/train/T1%20Caboolture or #transit/route/TSV/V200. */
  hash: string
  /** TransLink's own timetable page, when published. */
  url: string | null
  /** Station slugs the line calls at, by name. */
  stations: string[]
  /** Names of the other stops it calls at, by name. */
  stops: string[]
}

export interface Place {
  slug: string
  name: string
  council: string
  position: LngLat
  /** Stations within NEAR_KM, nearest first. */
  stations: Near[]
}

export interface Near {
  slug: string
  name: string
  km: number
}

export interface Directory {
  stations: Station[]
  lines: Line[]
  places: Place[]
}

/** How far from a point a station or locality counts as nearby; the same as the app's locality pages. */
export const NEAR_KM = 5
/** How many nearby localities a station page lists: inner Brisbane has dozens within NEAR_KM. */
export const NEARBY_PLACES = 10

export function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Great-circle distance in km between two published points. */
export function distanceKm(a: LngLat, b: LngLat) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Stops in TransLink's data that trams and trains use to turn around or relieve crews, not to carry passengers. */
const OPERATIONAL = /\b(turnback|relief point)\b/i

const MODE_RANK: VehicleMode[] = ['train', 'tram', 'ferry', 'bus']
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en', { numeric: true })

/** Keeps slugs unique by appending a fallback when two names collide. */
function uniqueSlug(taken: Set<string>, base: string, fallback: string) {
  const slug = taken.has(base) ? `${base}-${slugify(fallback)}` : base
  taken.add(slug)
  return slug
}

/** Route code → stop ids it calls at, from one region's compact index. */
function stopsByRoute(index: TimetableIndex, region: TransitRegion) {
  const r = index.regions[region]
  const out = new Map<string, Set<string>>()
  if (!r) return out
  for (const [stopId, packed] of Object.entries(r.stops)) {
    for (const i of packed.split('.')) {
      const code = r.routes[parseInt(i, 36)]
      if (!out.has(code)) out.set(code, new Set())
      out.get(code)!.add(stopId)
    }
  }
  return out
}

function buildLines(input: DirectoryInput): Line[] {
  const lines: Line[] = []
  const taken = new Set<string>()
  for (const region of TRANSIT_REGIONS) {
    const codes = input.index.regions[region]?.routes ?? []
    const info = (code: string) => input.routes.routes[`${region}:${code}`]
    // SEQ trains: one page per official T-line, covering every route code mapped to it.
    const byLine = new Map<string, string[]>()
    for (const code of codes) {
      const r = info(code)
      if (r?.mode === 'train' && r.line) byLine.set(r.line, [...(byLine.get(r.line) ?? []), code])
    }
    for (const [name, lineCodes] of byLine) {
      lines.push({
        slug: uniqueSlug(taken, slugify(name), region),
        region,
        mode: 'train',
        name,
        long: [...new Set(lineCodes.map((c) => info(c).long))].sort().join('; '),
        codes: lineCodes,
        hash: `transit/line/train/${encodeURIComponent(name)}`,
        url: info(lineCodes[0]).url ?? null,
        stations: [],
        stops: [],
      })
    }
    for (const code of codes) {
      const r = info(code)
      if (r?.mode === 'train' && r.line) continue
      const short = r?.short ?? code
      lines.push({
        slug: uniqueSlug(taken, slugify(`${region} ${short}`), code),
        region,
        mode: r?.mode ?? 'bus',
        name: short,
        long: r?.long ?? '',
        codes: [code],
        hash: `transit/route/${region}/${encodeURIComponent(code)}`,
        url: r?.url ?? null,
        stations: [],
        stops: [],
      })
    }
  }
  return lines
}

/** Every station, line and locality the directory has a page for. */
export function buildDirectory(input: DirectoryInput): Directory {
  const served = new Map(TRANSIT_REGIONS.map((r) => [r, stopsByRoute(input.index, r)] as const))
  const lines = buildLines(input)

  // Stops by region and id, parents first so a platform can find its station.
  const names = new Map<string, string>()
  const parentOf = new Map<string, string>()
  for (const file of [input.core, ...input.others]) {
    for (const [region, rows] of Object.entries(file.stops) as [TransitRegion, StopRow[]][]) {
      for (const [id, name, , , parent] of rows) {
        names.set(`${region}:${id}`, name)
        if (parent) parentOf.set(`${region}:${id}`, parent)
      }
    }
  }
  const stationOf = (region: TransitRegion, id: string) => parentOf.get(`${region}:${id}`) ?? id

  // Which station each route calls at, so stations know their lines and lines their stations.
  const routeStations = new Map<string, Set<string>>()
  for (const [region, byRoute] of served) {
    for (const [code, stopIds] of byRoute) routeStations.set(`${region}:${code}`, new Set([...stopIds].map((id) => stationOf(region, id))))
  }
  const linesAt = (region: TransitRegion, id: string) => lines.filter((l) => l.region === region && l.codes.some((c) => routeStations.get(`${region}:${c}`)?.has(id)))

  const taken = new Set<string>()
  const stations: Station[] = []
  for (const [region, rows] of Object.entries(input.core.stops) as [TransitRegion, StopRow[]][]) {
    for (const [id, name, lat, lng, parent] of rows) {
      if (parent || OPERATIONAL.test(name)) continue
      const here = linesAt(region, id)
      if (!here.length) continue
      const mode = MODE_RANK.find((m) => here.some((l) => l.mode === m))!
      const platforms = rows
        .filter((r) => r[4] === id && r[5])
        .map((r) => String(r[5]))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      stations.push({ slug: uniqueSlug(taken, slugify(name), id), id, region, name, mode, position: [lng, lat], platforms, lines: here.map((l) => l.slug), places: [] })
    }
  }
  stations.sort(byName)

  const stationBy = new Map(stations.map((s) => [`${s.region}:${s.id}`, s]))
  for (const line of lines) {
    const seen = new Set<string>()
    const stops: string[] = []
    for (const code of line.codes) {
      for (const id of routeStations.get(`${line.region}:${code}`) ?? []) {
        const st = stationBy.get(`${line.region}:${id}`)
        if (st) seen.add(st.slug)
        else {
          const name = names.get(`${line.region}:${id}`)
          if (name && !OPERATIONAL.test(name) && !stops.includes(name)) stops.push(name)
        }
      }
    }
    line.stations = stations.filter((s) => seen.has(s.slug)).map((s) => s.slug)
    line.stops = stops.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  }

  // One page per locality name, the first in the gazetteer, as the app's #place/locality/<name> resolves it.
  const placeTaken = new Set<string>()
  const places: Place[] = []
  const seenNames = new Set<string>()
  for (const [name, lng, lat, council] of input.places.places) {
    if (seenNames.has(name)) continue
    seenNames.add(name)
    places.push({ slug: uniqueSlug(placeTaken, slugify(name), council), name, council, position: [lng, lat], stations: [] })
  }
  places.sort(byName)
  for (const p of places) {
    for (const s of stations) {
      const km = distanceKm(p.position, s.position)
      if (km > NEAR_KM) continue
      p.stations.push({ slug: s.slug, name: s.name, km })
      s.places.push({ slug: p.slug, name: p.name, km })
    }
    p.stations.sort((a, b) => a.km - b.km)
  }
  for (const s of stations) s.places = s.places.sort((a, b) => a.km - b.km).slice(0, NEARBY_PLACES)

  return { stations, lines, places }
}

const readJson = <T>(file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8')) as T

let loaded: Directory | null = null

/** The directory built from the repo's published data files, read once per process. */
export function loadDirectory(): Directory {
  loaded ??= buildDirectory({
    core: readJson<StopFile>('../src/data/translink-stops.json'),
    others: [readJson<StopFile>('../src/data/translink-stops-bus.json'), readJson<StopFile>('../src/data/translink-stops-regional.json')],
    routes: readJson<RouteFile>('../src/data/translink-routes.json'),
    index: readJson<TimetableIndex>('../public/timetables/index.json'),
    places: readJson<PlaceFile>('../src/data/qld-places.json'),
  })
  return loaded
}

/** What to call a mode's stopping place: "train station", "tram stop", "ferry terminal", "bus stop". */
export function stationKind(mode: VehicleMode) {
  return mode === 'train' ? 'train station' : mode === 'tram' ? 'tram stop' : mode === 'ferry' ? 'ferry terminal' : 'bus stop'
}

export function regionName(region: TransitRegion) {
  return REGION_NAMES[region]
}
