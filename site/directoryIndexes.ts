// The three directory index pages: /stations/, /lines/ and /places/.
import { regionName, stationKind, type Directory } from './directory.ts'
import { HOME, LINES, PLACES, STATIONS, capital, lineTitle, linePath, placePath, stationPath, type StaticPage } from './pageKit.ts'

function grouped<T>(items: T[], key: (t: T) => string, order?: string[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  const keys = order ? order.filter((k) => groups.has(k)) : [...groups.keys()].sort()
  return keys.map((k) => [k, groups.get(k)!])
}

export function stationsIndex(d: Directory): StaticPage {
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

export function linesIndex(d: Directory): StaticPage {
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

export function placesIndex(d: Directory): StaticPage {
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
