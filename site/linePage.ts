// A page per Translink line and route: the stations and stops it calls at in
// the published timetable, listed by name.
import { regionName, type Directory, type Line } from './directory.ts'
import { MAIN_REGIONS } from '../src/lib/transitRegions.ts'
import { DESCRIPTION_MAX, HOME, LINES, LIVE_NOTE, TITLE_MAX, count, fit, join, lineTitle, linePath, stationPath, type StaticPage } from './pageKit.ts'

export function linePage(l: Line, d: Directory): StaticPage {
  const title = lineTitle(l)
  const region = regionName(l.region)
  const stations = l.stations.map((slug) => d.stations.find((s) => s.slug === slug)!)
  const what = l.mode === 'train' ? 'train line' : `${l.mode} route`
  const routes = l.mode === 'train' ? ` It covers the routes ${join(l.codes.map((c) => `${c}`))} in Translink's timetable${l.long ? ` (${l.long})` : ''}.` : ''
  const order = stations.length + l.stops.length > 1 ? ' They are listed by name, not in running order; the app shows the order and times for each trip.' : ''
  // Outside SEQ the name alone repeats across networks ("Route 200"), so the network goes in the title.
  const where = l.region === 'SEQ' ? '' : `, ${region}`
  const short = l.mode === 'train' ? title : title.slice(0, title.length - (l.long ? l.long.length + 1 : 0))
  const titles = [`${title}${where}: ${l.mode} timetable and stops`, `${short}${where}: ${l.mode} timetable and stops`, `${short}${where} ${l.mode} timetable`]
  // Only SEQ and Cairns have live times all day; elsewhere the app shows the timetable.
  const departures = MAIN_REGIONS.includes(l.region) ? 'live departures' : 'departures'
  const stops = count(stations.length + l.stops.length, 'stop')
  const md = [
    `# ${title}`,
    '',
    `${title} is a Translink ${what} on the ${region} network.${routes} It calls at ${stations.length + l.stops.length} ${stations.length + l.stops.length === 1 ? 'stop' : 'stops'} in the published timetable.${order}`,
    '',
    ...(stations.length ? ['## Stations', '', ...stations.map((s) => `- [${s.name}](${stationPath(s)})`), ''] : []),
    ...(l.stops.length ? [stations.length ? '## Other stops' : '## Stops', '', ...l.stops.map((n) => `- ${n}`), ''] : []),
    '## Timetable',
    '',
    `${l.url ? `Translink's published timetable for ${title}: [${l.url}](${l.url}). ` : ''}${LIVE_NOTE}`,
  ].join('\n')
  return {
    path: linePath(l),
    title: fit(TITLE_MAX, titles),
    description: fit(DESCRIPTION_MAX, [
      `The published timetable, ${departures} and ${stops} for ${title}, a Translink ${what} on the ${region} network.`,
      `The published timetable, ${departures} and ${stops} for ${short}, a Translink ${what} on the ${region} network.`,
    ]),
    markdown: md,
    crumbs: [HOME, LINES, { name: title, path: linePath(l) }],
    open: { hash: l.hash, label: `Open ${title} in Roadbeat` },
  }
}
