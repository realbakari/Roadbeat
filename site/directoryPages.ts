// Turns the directory model (site/directory.ts) into pages: one per station,
// line and locality, plus an index page for each kind. Each page is written
// as the Markdown subset site/plugin.ts renders, so it becomes both an HTML
// page and a .md page. The pages carry only published facts; anything live
// (departures, delays, what is happening at a place now) is in the app, and
// the pages say so rather than baking a figure into static HTML.
import { NEAR_KM, regionName, stationKind, type Directory, type Line, type Place, type Station } from './directory.ts'

export interface Crumb {
  name: string
  path: string
}

/** A static page the plugin renders: the trust pages and every directory page share this shape. */
export interface StaticPage {
  path: string
  title: string
  description: string
  markdown: string
  crumbs: Crumb[]
  /** The app view this page opens: a hash and a button label. */
  open?: { hash: string; label: string }
  /** Extra JSON-LD objects for the page (the breadcrumb list is added by the plugin). */
  jsonLd?: Record<string, unknown>[]
  noindex?: boolean
}

const HOME: Crumb = { name: 'Roadbeat', path: '/' }
const STATIONS: Crumb = { name: 'Stations', path: '/stations/' }
const LINES: Crumb = { name: 'Lines and routes', path: '/lines/' }
const PLACES: Crumb = { name: 'Places', path: '/places/' }

const stationPath = (s: Station | string) => `/stations/${typeof s === 'string' ? s : s.slug}/`
const linePath = (l: Line | string) => `/lines/${typeof l === 'string' ? l : l.slug}/`
const placePath = (p: Place | string) => `/places/${typeof p === 'string' ? p : p.slug}/`

const km = (n: number) => `${n < 0.95 ? Math.round(n * 10) / 10 : Math.round(n)} km`
const coords = (p: [number, number]) => `${p[1]}, ${p[0]}`
const join = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

/** A line's rider-facing title: "T1 Caboolture", "F1 Northshore Hamilton / UQ St Lucia", "Route 200 Ferry Terminal - City". */
export function lineTitle(l: Line) {
  if (l.mode === 'train') return l.name
  const prefix = /^[A-Z]/.test(l.name) ? l.name : `Route ${l.name}`
  return l.long ? `${prefix} ${l.long}` : prefix
}

const LIVE_NOTE = 'Live departures, TransLink real-time times and the full published timetable for any day are in the Roadbeat app, not on this page.'

function stationPage(s: Station, d: Directory): StaticPage {
  const lines = s.lines.map((slug) => d.lines.find((l) => l.slug === slug)!)
  const kind = stationKind(s.mode)
  const region = regionName(s.region)
  const lineNames = join(lines.map(lineTitle))
  const fewLines = lines.length > 4 ? `${lines.slice(0, 3).map(lineTitle).join(', ')} and ${lines.length - 3} more` : lineNames
  const platforms = s.platforms.length ? ` It has ${s.platforms.length === 1 ? 'one platform' : `${s.platforms.length} platforms`} in TransLink's stop data (${join(s.platforms)}).` : ''
  const md = [
    `# ${s.name}`,
    '',
    `${s.name} is a ${kind} on TransLink's ${region} network, served by ${lineNames} in the published timetable.${platforms} TransLink publishes its position as ${coords(s.position)} (stop id ${s.id}).`,
    '',
    '## Lines and routes',
    '',
    ...lines.map((l) => `- [${lineTitle(l)}](${linePath(l)})${l.mode === 'train' ? `: ${l.long}` : ''}`),
    '',
    ...(s.places.length ? ['## Nearby localities', '', ...s.places.map((p) => `- [${p.name}](${placePath(p.slug)}), ${km(p.km)} from the ${kind}'s published point`), ''] : []),
    '## In the Roadbeat app',
    '',
    LIVE_NOTE,
  ].join('\n')
  const type = s.mode === 'ferry' ? 'BoatTerminal' : s.mode === 'bus' ? 'BusStation' : 'TrainStation'
  return {
    path: stationPath(s),
    title: s.name,
    description: `${s.name}, a ${kind} in ${region} on ${fewLines}: lines, platforms, nearby suburbs and a link to live departures and the published timetable in Roadbeat.`,
    markdown: md,
    crumbs: [HOME, STATIONS, { name: s.name, path: stationPath(s) }],
    open: { hash: `transit/stop/${s.region}/${encodeURIComponent(s.id)}`, label: `Open ${s.name} in Roadbeat` },
    jsonLd: [{ '@type': type, name: s.name, geo: { '@type': 'GeoCoordinates', latitude: s.position[1], longitude: s.position[0] }, publicAccess: true }],
  }
}

function linePage(l: Line, d: Directory): StaticPage {
  const title = lineTitle(l)
  const region = regionName(l.region)
  const stations = l.stations.map((slug) => d.stations.find((s) => s.slug === slug)!)
  const what = l.mode === 'train' ? 'train line' : `${l.mode} route`
  const routes = l.mode === 'train' ? ` It covers the routes ${join(l.codes.map((c) => `${c}`))} in TransLink's timetable${l.long ? ` (${l.long})` : ''}.` : ''
  const order = stations.length + l.stops.length > 1 ? ' They are listed by name, not in running order; the app shows the order and times for each trip.' : ''
  const md = [
    `# ${title}`,
    '',
    `${title} is a TransLink ${what} in ${region}.${routes} It calls at ${stations.length + l.stops.length} ${stations.length + l.stops.length === 1 ? 'stop' : 'stops'} in the published timetable.${order}`,
    '',
    ...(stations.length ? ['## Stations', '', ...stations.map((s) => `- [${s.name}](${stationPath(s)})`), ''] : []),
    ...(l.stops.length ? [stations.length ? '## Other stops' : '## Stops', '', ...l.stops.map((n) => `- ${n}`), ''] : []),
    '## Timetable',
    '',
    `${l.url ? `TransLink's published timetable for ${title}: [${l.url}](${l.url}). ` : ''}${LIVE_NOTE}`,
  ].join('\n')
  return {
    path: linePath(l),
    title,
    description: `${title}, a TransLink ${what} in ${region}: the ${stations.length + l.stops.length} stops it serves, its official timetable, and live departures in Roadbeat.`,
    markdown: md,
    crumbs: [HOME, LINES, { name: title, path: linePath(l) }],
    open: { hash: l.hash, label: `Open ${title} in Roadbeat` },
  }
}

function placePage(p: Place, d: Directory): StaticPage {
  const stations = p.stations.map((n) => ({ ...n, mode: d.stations.find((s) => s.slug === n.slug)!.mode }))
  const md = [
    `# ${p.name}`,
    '',
    `${p.name} is a locality in the ${p.council} local government area, Queensland. The Queensland place names gazetteer puts it at ${coords(p.position)}.`,
    '',
    ...(stations.length
      ? [`## Stations within ${NEAR_KM} km`, '', ...stations.map((s) => `- [${s.name}](${stationPath(s.slug)}), ${capital(stationKind(s.mode))}, ${km(s.km)} from the gazetteer point`), '']
      : ['No train station, tram stop or ferry terminal in TransLink\'s stop data lies within ' + NEAR_KM + ' km of the gazetteer point.', '']),
    '## In the Roadbeat app',
    '',
    `The Roadbeat app gathers what official sources publish at ${p.name} right now: road events, bushfire warnings, traffic cameras, air quality, council centres, power outages, news stories and stream gauges, each from its publisher's own feed. None of that is on this page, because it changes by the minute.`,
  ].join('\n')
  return {
    path: placePath(p),
    title: p.name,
    description: `${p.name}, ${p.council}, Queensland: nearby stations and a link to the live road, transport, fire and gauge information official sources publish there, in Roadbeat.`,
    markdown: md,
    crumbs: [HOME, PLACES, { name: p.name, path: placePath(p) }],
    open: { hash: `place/locality/${encodeURIComponent(p.name)}`, label: `Open ${p.name} in Roadbeat` },
    jsonLd: [
      {
        '@type': 'Place',
        name: p.name,
        geo: { '@type': 'GeoCoordinates', latitude: p.position[1], longitude: p.position[0] },
        containedInPlace: { '@type': 'AdministrativeArea', name: p.council, containedInPlace: { '@type': 'State', name: 'Queensland' } },
      },
    ],
  }
}

function grouped<T>(items: T[], key: (t: T) => string, order?: string[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  const keys = order ? order.filter((k) => groups.has(k)) : [...groups.keys()].sort()
  return keys.map((k) => [k, groups.get(k)!])
}

function stationsIndex(d: Directory): StaticPage {
  const md = [
    '# Train stations, tram stops and ferry terminals',
    '',
    `Every ${d.stations.length} train station, tram stop and ferry terminal in TransLink's published South East Queensland timetable, with the lines that serve it. Bus stops are in the app.`,
    '',
    ...grouped(d.stations, (s) => capital(stationKind(s.mode)) + 's', ['Train stations', 'Tram stops', 'Ferry terminals', 'Bus stops']).flatMap(([title, list]) => [`## ${title}`, '', ...list.map((s) => `- [${s.name}](${stationPath(s)})`), '']),
  ].join('\n')
  return {
    path: STATIONS.path,
    title: STATIONS.name,
    description: `Every train station, tram stop and ferry terminal on TransLink's South East Queensland network, with its lines, platforms and a link to live departures in Roadbeat.`,
    markdown: md,
    crumbs: [HOME, STATIONS],
  }
}

function linesIndex(d: Directory): StaticPage {
  const regions = [...new Set(d.lines.map((l) => l.region))]
  const md = [
    '# TransLink lines and routes',
    '',
    `Every line and route in TransLink's published timetables: ${d.lines.length} across ${regions.length} networks, from South East Queensland's train lines to each regional town's bus routes.`,
    '',
    ...grouped(d.lines, (l) => regionName(l.region), regions.map(regionName)).flatMap(([title, list]) => [`## ${title}`, '', ...list.map((l) => `- [${lineTitle(l)}](${linePath(l)})`), '']),
  ].join('\n')
  return {
    path: LINES.path,
    title: LINES.name,
    description: `Every TransLink train line, tram, ferry and bus route in Queensland's published timetables, by network, with the stops each serves and live departures in Roadbeat.`,
    markdown: md,
    crumbs: [HOME, LINES],
  }
}

function placesIndex(d: Directory): StaticPage {
  const md = [
    '# Queensland places',
    '',
    `Every town, suburb and locality in the Queensland place names gazetteer (${d.places.length}), by local government area. Each page names the stations nearby and opens the live view of what official sources publish there.`,
    '',
    ...grouped(d.places, (p) => p.council).flatMap(([title, list]) => [`## ${title}`, '', ...list.map((p) => `- [${p.name}](${placePath(p)})`), '']),
  ].join('\n')
  return {
    path: PLACES.path,
    title: PLACES.name,
    description: 'Every town, suburb and locality in Queensland, by council area, each with nearby stations and a link to the live road, transport, fire and gauge information official sources publish there.',
    markdown: md,
    crumbs: [HOME, PLACES],
  }
}

/** Every directory page: three index pages, then a page per station, line and locality. */
export function directoryPages(d: Directory): StaticPage[] {
  return [stationsIndex(d), linesIndex(d), placesIndex(d), ...d.stations.map((s) => stationPage(s, d)), ...d.lines.map((l) => linePage(l, d)), ...d.places.map((p) => placePage(p, d))]
}
