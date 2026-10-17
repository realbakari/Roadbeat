// A page per gazetteer locality: where the gazetteer puts it and the
// stations within NEAR_KM of that point.
import { NEAR_KM, stationKind, type Directory, type Place } from './directory.ts'
import { HOME, PLACES, capital, coords, km, placePath, stationPath, type StaticPage } from './pageKit.ts'

export function placePage(p: Place, d: Directory): StaticPage {
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
