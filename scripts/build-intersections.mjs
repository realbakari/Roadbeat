// Builds src/data/bcc-intersections.json: Brisbane City Council's signalised
// intersections (data.brisbane.qld.gov.au "Traffic Management — Intersection
// locations — reference", CC BY 4.0), cut down to what the map needs. The full
// reference is 2.3 MB of per-detector wiring; this keeps each site's SCATS
// number, suburb, position and the street names on its arms.
// Run with `npm run data:intersections` when the council adds or moves signals.
import { writeFileSync } from 'node:fs'

const URL_ =
  'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/traffic-management-intersection-locations-reference/exports/json?select=tsc,suburb,arms,latitude,longitude'

const res = await fetch(URL_)
if (!res.ok) throw new Error(`Intersection reference responded with ${res.status}`)
const rows = await res.json()

const title = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
const round = (n) => Math.round(n * 1e5) / 1e5

const sites = []
for (const r of rows) {
  if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue
  let arms = []
  try {
    arms = JSON.parse(r.arms ?? '[]')
  } catch {
    // A site whose arms don't parse still has a position and a number.
  }
  const streets = [...new Set(arms.map((a) => a.streetName && title(a.streetName.trim())).filter(Boolean))]
  sites.push([String(r.tsc), title(r.suburb ?? ''), round(r.latitude), round(r.longitude), streets])
}
sites.sort((a, b) => Number(a[0]) - Number(b[0]))

if (sites.length < 500) throw new Error(`Only ${sites.length} intersections found; the dataset may have changed`)
const json = JSON.stringify({
  source: 'Brisbane City Council, Traffic Management — Intersection locations — reference, CC BY 4.0',
  generated: new Date().toISOString().slice(0, 10),
  sites,
})
writeFileSync(new URL('../src/data/bcc-intersections.json', import.meta.url), json)
console.log(`${sites.length} of ${rows.length} intersections have a position; ${(json.length / 1024).toFixed(0)} KB`)
