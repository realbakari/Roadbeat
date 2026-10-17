// The three directory index pages: /stations/, /lines/ and /places/.
import { regionName, slugify, stationKind, type Directory } from './directory.ts'
import { HOME, LINES, PLACES, STATIONS, capital, count, lineTitle, linePath, placePath, stationPath, type StaticPage } from './pageKit.ts'

/** One line of in-page links to each group's heading, for long indexes. */
const jumpList = (label: string, titles: string[]) => `${label}: ${titles.map((t) => `[${t}](#${slugify(t)})`).join(', ')}.`

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
    `All ${count(d.stations.length, 'train station, tram stop and ferry terminal', 'train stations, tram stops and ferry terminals')} in Translink's published South East Queensland timetable, with the lines that serve each. Bus stops are in the app.`,
    '',
    ...grouped(d.stations, (s) => capital(stationKind(s.mode)) + 's', ['Train stations', 'Tram stops', 'Ferry terminals', 'Bus stops']).flatMap(([title, list]) => [`## ${title}`, '', ...list.map((s) => `- [${s.name}](${stationPath(s)})`), '']),
  ].join('\n')
  return {
    path: STATIONS.path,
    title: 'Train stations, tram stops and ferry terminals in SEQ',
    description: "Live departures and timetables for every train station, tram stop and ferry terminal on Translink's South East Queensland network.",
    markdown: md,
    crumbs: [HOME, STATIONS],
  }
}

export function linesIndex(d: Directory): StaticPage {
  // South East Queensland first, then the regional networks by name.
  const regions = [...new Set(d.lines.map((l) => l.region))].sort((a, b) => Number(b === 'SEQ') - Number(a === 'SEQ') || regionName(a).localeCompare(regionName(b)))
  const groups = grouped(d.lines, (l) => regionName(l.region), regions.map(regionName))
  const md = [
    '# Translink lines and routes',
    '',
    `Every line and route in Translink's published timetables: ${d.lines.length.toLocaleString('en-AU')} across ${regions.length} networks, from South East Queensland's train lines to each regional town's bus routes.`,
    '',
    jumpList('Jump to a network', groups.map(([title]) => title)),
    '',
    ...groups.flatMap(([title, list]) => [`## ${title}`, '', ...list.map((l) => `- [${lineTitle(l)}](${linePath(l)})`), '']),
  ].join('\n')
  return {
    path: LINES.path,
    title: 'Translink lines and routes: timetables and stops',
    description: "Timetables and stops for every Translink train line and tram, ferry and bus route in Queensland, by network, with departures in the Roadbeat app.",
    markdown: md,
    crumbs: [HOME, LINES],
  }
}

/** The group for the few gazetteer places that name no council. */
const NO_COUNCIL = 'No council area'

export function placesIndex(d: Directory): StaticPage {
  const councils = [...new Set(d.places.map((p) => p.council).filter(Boolean))].sort()
  const groups = grouped(d.places, (p) => p.council || NO_COUNCIL, [...councils, NO_COUNCIL])
  const md = [
    '# Queensland places',
    '',
    `Every town, suburb and locality in the Queensland place names gazetteer, ${d.places.length.toLocaleString('en-AU')} in all, by local government area. Each page names the stations nearby and opens the live view of what official sources publish there.`,
    '',
    jumpList('Jump to a council area', groups.map(([title]) => title)),
    '',
    ...groups.flatMap(([title, list]) => [`## ${title}`, '', ...list.map((p) => `- [${p.name}](${placePath(p)})`), '']),
  ].join('\n')
  return {
    path: PLACES.path,
    title: 'Queensland places: traffic, transport and warnings',
    description: 'Road events, warnings and transport at every Queensland town, suburb and locality, by council area, live from official sources in the Roadbeat app.',
    markdown: md,
    crumbs: [HOME, PLACES],
  }
}
