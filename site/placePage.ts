// A page per gazetteer locality: where the gazetteer puts it and the
// stations within NEAR_KM of that point. Localities with no station that
// close are noindex, so they stay out of search and the sitemap.
import { NEAR_KM, stationKind, type Directory, type Place } from './directory.ts'
import { DESCRIPTION_MAX, HOME, PLACES, TITLE_MAX, areaName, capital, coords, count, fit, km, placePath, stationPath, type StaticPage } from './pageKit.ts'

export function placePage(p: Place, d: Directory): StaticPage {
  const stations = p.stations.map((n) => ({ ...n, mode: d.stations.find((s) => s.slug === n.slug)!.mode }))
  const area = areaName(p.council)
  const titles = [`${p.name}, ${area}: traffic, transport and warnings`, `${p.name}: traffic, transport and warnings`, `${p.name}, ${area}`, p.name]
  // "Injinoo (Northern Peninsula Area Regional)" already names its council.
  const named = p.council && !p.name.includes(p.council) ? `${p.name}, ${p.council}` : p.name
  const lead = `Road events, warnings and transport at ${named}, live from official sources in Roadbeat`
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
    title: fit(TITLE_MAX, titles),
    description: fit(DESCRIPTION_MAX, [stations.length ? `${lead}, and the ${count(stations.length, 'station')} within ${NEAR_KM} km.` : `${lead}.`, `${lead}.`]),
    markdown: md,
    crumbs: [HOME, PLACES, { name: p.name, path: placePath(p) }],
    // With no station nearby the page is the gazetteer point and the app link, the
    // same for thousands of localities: kept for people, left out of search.
    noindex: !stations.length,
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
