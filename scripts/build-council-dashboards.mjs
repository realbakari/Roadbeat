// Builds src/data/council-dashboards.json: the Queensland council disaster
// dashboards the news monitor reads. The list is the Queensland Government's own
// CSV behind its "Local government disaster dashboards" page. A dashboard is kept
// only if it answers the QIT Plus platform's JSON feed (/dashboard/imsBulletin),
// which about 58 of the 78 do. Each council is matched to its council area in
// src/data/qld-places.json, so its bulletins can be filtered by area.
//
// Several dashboards send an incomplete TLS certificate chain, which Node rejects
// (browsers fill the gap). For those the server reads the feed over plain http,
// the address the state's own list gives for many of them; links for people
// stay https. Certificate checks are never turned off.
// Run with `npm run data:dashboards` when councils change dashboards.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsv } from './lib/gtfs.mjs'

const PAGE = 'https://www.qld.gov.au/community/disasters-emergencies/disasters/resources-translations/local-government-disaster-dashboards'
const LIST = 'https://www.qld.gov.au/community/disasters-emergencies/disasters/resources-translations/?a=228165'

const rows = parseCsv((await (await fetch(LIST)).text()).replace(/^\uFEFF/, ''))
const links = rows
  .map((r) => ({ council: r['Local Government']?.trim(), href: r['Disaster Dashboard or disaster web page']?.trim() }))
  .filter((r) => r.council && /^https?:\/\//.test(r.href ?? ''))
  .map((r) => ({ council: r.council, root: `https://${r.href.split('://')[1].replace(/\/+$/, '')}` }))
if (links.length < 60) throw new Error(`Only ${links.length} councils on the list; expected about 77`)

const lgas = new Set(JSON.parse(readFileSync(new URL('../src/data/qld-places.json', import.meta.url), 'utf8')).places.map((p) => p[3]))

const key = (s) => s.toLowerCase().replace(/[-\s]+/g, ' ')
const lgaByKey = new Map([...lgas].map((l) => [key(l), l]))

/** The gazetteer's name for a council's area: "Ipswich City Council" is "Ipswich City". Renamed councils match on their place name alone. */
function areaOf(council) {
  const base = key(council.replace(/ Council$/, ''))
  if (lgaByKey.has(base)) return lgaByKey.get(base)
  const place = base.replace(/ (city|regional|shire|aboriginal shire|town)$/, '')
  const candidates = [...lgaByKey.keys()].filter((l) => l.startsWith(`${place} `))
  return candidates.length === 1 ? lgaByKey.get(candidates[0]) : null
}

async function isQitPlus(feed) {
  try {
    const res = await fetch(`${feed}/dashboard/imsBulletin`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    const body = await res.json()
    return body?.rights?.ownership === 'QIT Plus' && Array.isArray(body.features)
  } catch {
    return false
  }
}

/** The address the server can read the feed from: https if Node accepts its certificate, else http, else null. */
async function feedAddress(root) {
  if (await isQitPlus(root)) return root
  const http = root.replace(/^https:/, 'http:')
  return (await isQitPlus(http)) ? http : null
}

const checked = await Promise.all(links.map(async (l) => ({ ...l, feed: await feedAddress(l.root) })))
const dashboards = checked
  .filter((l) => l.feed)
  .map((l) => [l.council, areaOf(l.council), l.root, l.feed])
  .sort((a, b) => a[0].localeCompare(b[0]))

const out = {
  source: `Queensland Government, Local government disaster dashboards (${PAGE}), checked for the QIT Plus dashboard feed`,
  generated: new Date().toISOString().slice(0, 10),
  dashboards,
}
writeFileSync(new URL('../src/data/council-dashboards.json', import.meta.url), JSON.stringify(out, null, 1))
const unmatched = dashboards.filter((d) => !d[1]).map((d) => d[0])
console.log(`${dashboards.length} of ${links.length} councils publish the dashboard feed${unmatched.length ? `; no council area for ${unmatched.join(', ')}` : ''}`)
