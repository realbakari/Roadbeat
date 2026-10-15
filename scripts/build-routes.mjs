// Builds src/data/translink-routes.json from TransLink's official open data:
//  - GTFS static feeds (routes.txt) for SEQ and Cairns: route names, type, colour, timetable URL
//  - "Train T Code Route Mapping" (data.qld.gov.au): Queensland Rail route codes → T-line ("T1 Caboolture")
// Run with `npm run data:routes` when TransLink publishes a new timetable. Needs `unzip` on PATH.
import { writeFileSync } from 'node:fs'
import { FEEDS, MODES, download, parseCsv, unzip } from './lib/gtfs.mjs'

const T_CODES =
  'https://www.data.qld.gov.au/dataset/1c4c0295-135f-48d8-bc26-7391ffc5fd70/resource/854d17aa-2d85-49a4-9e3e-ff7c06b596a7/download/train-t-code-mapping-v2.xlsx'

/** Reads the first sheet of a simple .xlsx (shared strings only). */
function readXlsx(path) {
  const strings = [...unzip(path, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ''),
  )
  const sheet = unzip(path, 'xl/worksheets/sheet1.xml')
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
    [...r[1].matchAll(/<c ([^>]*)>(?:<v>([^<]*)<\/v>)?/g)].map(([, attrs, v]) =>
      attrs.includes('t="s"') && v != null ? strings[Number(v)] : (v ?? ''),
    ),
  )
}

const routes = {}
for (const [region, url] of Object.entries(FEEDS)) {
  const zip = await download(url, `${region}.zip`)
  for (const r of parseCsv(unzip(zip, 'routes.txt'))) {
    const code = r.route_id.replace(/-\d+$/, '')
    const key = `${region}:${code}`
    if (routes[key]) continue
    routes[key] = {
      short: r.route_short_name || code,
      long: r.route_long_name,
      mode: MODES[r.route_type] ?? 'bus',
      color: r.route_color ? `#${r.route_color}` : null,
      url: r.route_url || null,
    }
  }
}

const tcodes = readXlsx(await download(T_CODES, 'tcodes.xlsx')).slice(1)
let matched = 0
for (const [code, t, name] of tcodes) {
  const r = routes[`SEQ:${code}`]
  if (r && t && name) {
    r.line = `${t} ${name}`
    matched++
  }
}

const out = {
  source: 'TransLink GTFS (SEQ, Cairns) and Train T Code Route Mapping, data.qld.gov.au, CC BY 4.0',
  generated: new Date().toISOString().slice(0, 10),
  routes,
}
writeFileSync(new URL('../src/data/translink-routes.json', import.meta.url), JSON.stringify(out))
console.log(`${Object.keys(routes).length} routes, ${matched} train codes mapped to T-lines`)
