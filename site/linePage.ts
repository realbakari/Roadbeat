// A page per TransLink line and route: the stations and stops it calls at in
// the published timetable, listed by name.
import { regionName, type Directory, type Line } from './directory.ts'
import { HOME, LINES, LIVE_NOTE, join, lineTitle, linePath, stationPath, type StaticPage } from './pageKit.ts'

export function linePage(l: Line, d: Directory): StaticPage {
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
