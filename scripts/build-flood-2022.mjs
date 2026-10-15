// Builds public/flood-2022.json: Brisbane City Council's adopted extent of the
// February 2022 Brisbane River and creek flood (data.brisbane.qld.gov.au
// "Flood — Awareness — Historic Brisbane River and Creek Floods Feb 2022",
// CC BY 4.0). The council's file is about 29 MB; outlines are simplified to
// about 5 m and coordinates rounded to about 1 m, which keeps the shape at map
// scale and makes the file small enough to load on demand.
// Run with `npm run data:flood2022` if the council revises the extent.
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { simplify } from './lib/simplify.mjs'

const URL_ =
  'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/flood-awareness-historic-brisbane-river-and-creek-floods-feb-2022/exports/geojson'
const TOLERANCE = 0.00005 // degrees, ~5 m

const round = (n) => Math.round(n * 1e5) / 1e5
// A ring starts and ends on the same point, which Douglas–Peucker can't measure
// against, so simplify it as an open line and close it again.
const ring = (r) => {
  const open = simplify(r.slice(0, -1), TOLERANCE).map(([x, y]) => [round(x), round(y)])
  return open.length >= 3 ? [...open, open[0]] : null
}
const polygon = (p) => {
  const rings = p.map(ring)
  return rings[0] ? rings.filter(Boolean) : null
}

const src = await (await fetch(URL_)).json()
const polygons = []
let before = 0
for (const f of src.features) {
  const g = f.geometry
  const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  for (const p of list) {
    before += p.reduce((n, r) => n + r.length, 0)
    const s = polygon(p)
    if (s) polygons.push(s)
  }
}
const out = {
  type: 'FeatureCollection',
  source: 'Brisbane City Council, Flood Awareness: Historic Brisbane River and Creek Floods Feb 2022 (CC BY 4.0)',
  generated: new Date().toISOString().slice(0, 10),
  features: [{ type: 'Feature', properties: { event: 'February 2022' }, geometry: { type: 'MultiPolygon', coordinates: polygons } }],
}
const json = JSON.stringify(out)
writeFileSync(new URL('../public/flood-2022.json', import.meta.url), json)
const after = polygons.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0)
console.log(`${src.features.length} features, ${before} → ${after} points, ${(json.length / 1e6).toFixed(1)} MB, ${(gzipSync(json).length / 1e6).toFixed(2)} MB compressed`)
