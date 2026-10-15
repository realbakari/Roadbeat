// Builds src/data/translink-maps.json: every map TransLink lists on
// https://translink.com.au/plan-your-journey/maps (network, busway and
// station/locality PDFs), grouped by region the way that page groups them.
// Run with `npm run data:maps` when TransLink updates its maps.
import { writeFileSync } from 'node:fs'

const PAGE = 'https://translink.com.au/plan-your-journey/maps'
const html = await (await fetch(PAGE, { headers: { 'user-agent': 'Mozilla/5.0 (Roadbeat data build)' } })).text()

const text = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const isMap = (href) => /widen\.net|\.pdf(\?|$)|acquiadam/i.test(href)

const regions = []
let region = null
let group = 'Network maps'
const add = (label, href) => {
  if (!region) regions.push((region = { region: 'South East Queensland', groups: [] }))
  let g = region.groups.find((x) => x.title === group)
  if (!g) region.groups.push((g = { title: group, maps: [] }))
  if (!g.maps.some((m) => m.href === href)) g.maps.push({ label, href })
}

// Walk links and section headings in page order.
for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>|<h3[^>]*>([\s\S]*?)<\/h3>/g)) {
  if (m[3] != null) {
    const h = text(m[3])
    if (h === 'Busway maps') group = 'Busway maps'
    else if (/^Station\/locality maps$/i.test(h)) group = 'Station and locality maps'
    continue
  }
  const attrs = m[1]
  const href = attrs.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&')
  if (!href) continue
  const label = text(m[2])
  // Region accordions ("Brisbane region", "Bowen"…) toggle a collapsed panel.
  if (/data-toggle="collapse"/.test(attrs) && href.startsWith('#')) {
    if (label === 'South East Queensland') continue // parent of the SEQ regions; its maps sit above it
    regions.push((region = { region: label.replace(/ region$/, ''), groups: [] }))
    group = 'Network maps'
    continue
  }
  if (isMap(href)) add(label.replace(/\s*\(PDF\)\s*/gi, ' ').trim(), new URL(href, PAGE).href)
}

const count = regions.reduce((n, r) => n + r.groups.reduce((k, g) => k + g.maps.length, 0), 0)
if (count < 50) throw new Error(`Only ${count} maps found; the page layout may have changed`)
writeFileSync(
  new URL('../src/data/translink-maps.json', import.meta.url),
  JSON.stringify({ source: PAGE, generated: new Date().toISOString().slice(0, 10), regions }),
)
console.log(`${regions.length} places, ${count} maps`)
for (const r of regions) console.log(`  ${r.region}: ${r.groups.map((g) => `${g.title} ${g.maps.length}`).join(', ')}`)
