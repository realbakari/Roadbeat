// Builds src/data/council-dashboards.json: the Queensland council disaster
// dashboards the news monitor reads. The list is the Queensland Government's own
// CSV behind its "Local government disaster dashboards" page. A dashboard is kept
// only if it answers the QIT Plus platform's JSON feed (/dashboard/imsBulletin),
// which about 58 of the 78 do. Each council is matched to its council area in
// src/data/qld-places.json, so its bulletins can be filtered by area.
//
// Each row is [council, council area, dashboard, feed address, site icon]. The icon is the one the
// council website declares, never a bare /favicon.ico guess: most council sites serve a platform
// default there, not the council's mark.
// Several dashboards send an incomplete TLS certificate chain, which Node rejects
// (browsers fill the gap). For those the server reads the feed over plain http,
// the address the state's own list gives for many of them; links for people
// stay https. Certificate checks are never turned off.
// Run with `npm run data:dashboards` when councils change dashboards.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsv } from './lib/gtfs.mjs'

const PAGE = 'https://www.qld.gov.au/community/disasters-emergencies/disasters/resources-translations/local-government-disaster-dashboards'
const LIST = 'https://www.qld.gov.au/community/disasters-emergencies/disasters/resources-translations/?a=228165'

const rows = parseCsv((await (await fetch(LIST)).text()).replace(/^\uFEFF/, ''))
const site = (s) => (/^https?:\/\//.test(s ?? '') ? `https://${s.trim().split('://')[1].replace(/\/+$/, '')}` : null)
const links = rows
  .map((r) => ({ council: r['Local Government']?.trim(), href: r['Disaster Dashboard or disaster web page']?.trim(), website: site(r.Website) }))
  .filter((r) => r.council && /^https?:\/\//.test(r.href ?? ''))
  .map((r) => ({ council: r.council, root: `https://${r.href.split('://')[1].replace(/\/+$/, '')}`, website: r.website }))
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

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'

/**
 * The icons a page declares in <link rel="icon"> and <link rel="apple-touch-icon">,
 * best first: Apple touch icons before favicons, larger before smaller.
 */
async function declaredIcons(site) {
  try {
    const res = await fetch(site, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []
    const html = await res.text()
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0])
    return links
      .map((tag) => {
        const attr = (name) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1]
        const rel = (attr('rel') ?? '').toLowerCase()
        const href = attr('href')
        if (!href || !/(^|\s)(icon|apple-touch-icon(-precomposed)?|shortcut icon)(\s|$)/.test(rel)) return null
        const size = Number(/(\d+)x\d+/.exec(attr('sizes') ?? '')?.[1] ?? 0)
        return { url: new URL(href, res.url).toString(), rank: (rel.includes('apple') ? 1000 : 0) + size }
      })
      .filter(Boolean)
      .sort((a, b) => b.rank - a.rank)
      .map((l) => l.url)
  } catch {
    return []
  }
}

/** The first declared icon that is an image, with its bytes' hash, so platform defaults shared by several councils can be dropped. */
async function iconOf(...sites) {
  for (const site of sites.filter(Boolean)) {
    for (const url of await declaredIcons(site)) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15_000) })
        if (!res.ok || !/^image\//.test(res.headers.get('content-type') ?? '')) continue
        const bytes = new Uint8Array(await res.arrayBuffer())
        if (bytes.length < 100) continue
        return { url, hash: createHash('sha1').update(bytes).digest('hex') }
      } catch {
        // Try the next.
      }
    }
  }
  return null
}

const checked = await Promise.all(links.map(async (l) => ({ ...l, feed: await feedAddress(l.root), icon: await iconOf(l.website, l.root) })))
// An icon file that two councils serve is their web platform's default, not either council's mark.
const shared = new Set([...checked.map((l) => l.icon?.hash).filter(Boolean)].filter((h, i, all) => all.indexOf(h) !== i))
const dashboards = checked
  .filter((l) => l.feed)
  .map((l) => [l.council, areaOf(l.council), l.root, l.feed, l.icon && !shared.has(l.icon.hash) ? l.icon.url : null])
  .sort((a, b) => a[0].localeCompare(b[0]))

const out = {
  source: `Queensland Government, Local government disaster dashboards (${PAGE}), checked for the QIT Plus dashboard feed`,
  generated: new Date().toISOString().slice(0, 10),
  dashboards,
}
writeFileSync(new URL('../src/data/council-dashboards.json', import.meta.url), JSON.stringify(out, null, 1))
const unmatched = dashboards.filter((d) => !d[1]).map((d) => d[0])
console.log(`${dashboards.length} of ${links.length} councils publish the dashboard feed; ${dashboards.filter((d) => d[4]).length} have a site icon${unmatched.length ? `; no council area for ${unmatched.join(', ')}` : ''}`)
