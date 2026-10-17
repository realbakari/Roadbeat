// A page per train station, tram stop and ferry terminal: its lines,
// platforms and nearby localities, as TransLink and the gazetteer publish them.
import { regionName, stationKind, type Directory, type Station } from './directory.ts'
import { HOME, LIVE_NOTE, STATIONS, coords, join, km, lineTitle, linePath, placePath, stationPath, type StaticPage } from './pageKit.ts'

export function stationPage(s: Station, d: Directory): StaticPage {
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
