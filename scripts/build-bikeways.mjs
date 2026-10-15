// Builds public/bikeways.json: Brisbane City Council's bikeway network
// (data.brisbane.qld.gov.au "Bikeway sections", CC BY 4.0), about 8,000 sections.
// The council's export is 8.7 MB; lines are simplified to about 3 m, coordinates
// rounded to about 1 m, and each section keeps only its type, hierarchy and
// street, so the map can load it when the cycling layer is turned on.
// Run with `npm run data:bikeways` when the council updates the network.
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { simplify } from './lib/simplify.mjs'

const URL_ = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/bikeway-sections/exports/json'
const TOLERANCE = 0.00003 // degrees, ~3 m

// The council's types, grouped the way the map colours them.
const KIND = {
  'SEPARATED PATHWAY': 'separated',
  'BICYCLE PATH': 'separated',
  'SHARED PATHWAY': 'shared',
  'BICYCLE LANE': 'lane',
  'BICYCLE ROUTE': 'route',
  'BICYCLE CROSSING': 'crossing',
  'INFORMAL ON ROAD': 'informal',
  'INFORMAL OFF ROAD': 'informal',
}
const round = (n) => Math.round(n * 1e5) / 1e5
const line = (pts) => simplify(pts, TOLERANCE).map(([x, y]) => [round(x), round(y)])
const title = (s) => (s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null)

const rows = await (await fetch(URL_)).json()
const features = []
let before = 0
for (const r of rows) {
  const g = r.geo_shape?.geometry
  if (!g) continue
  const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []
  const lines = parts.map((p) => (before += p.length, line(p))).filter((p) => p.length >= 2)
  if (!lines.length) continue
  features.push({
    type: 'Feature',
    properties: {
      kind: KIND[r.traffic_types_description] ?? 'other',
      type: r.traffic_types_description ?? null,
      hierarchy: title(r.hierarchy),
      street: title(r.street_name),
      name: r.bikeway_name && r.bikeway_name !== 'Unknown' ? r.bikeway_name : null,
      width: r.bikeway_width ?? null,
    },
    geometry: lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines },
  })
}
const out = { type: 'FeatureCollection', source: 'Brisbane City Council, Bikeway sections (CC BY 4.0)', generated: new Date().toISOString().slice(0, 10), features }
const json = JSON.stringify(out)
writeFileSync(new URL('../public/bikeways.json', import.meta.url), json)
const after = features.reduce((n, f) => n + JSON.stringify(f.geometry.coordinates).split('],[').length, 0)
console.log(`${features.length} sections, ${before} → ~${after} points, ${(json.length / 1e6).toFixed(1)} MB, ${(gzipSync(json).length / 1e6).toFixed(2)} MB compressed`)
