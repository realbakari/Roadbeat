// Builds public/transit-tracks.json: the train, tram and ferry lines as drawn by
// TransLink's published GTFS shapes (SEQ and regional Queensland), so the map can show the
// track a line runs on. One feature per route code, holding the shapes that
// together cover its track; geometry is simplified to ~3 m, which keeps the file
// small. TransLink's shapes follow the middle of a corridor (about 2 m from each
// rail of a double track, measured against OpenStreetMap), so storing them more
// precisely doesn't bring them closer to the rails; the map draws them as a
// corridor-wide band when zoomed in instead.
// Run with `npm run data:tracks` when TransLink publishes a new timetable. Needs `unzip`.
// Set TRANSLINK_GTFS_DIR to a folder holding SEQ.zip, CNS.zip, TSV.zip… to skip the download.
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { FEEDS, MODES, download, eachRow, parseCsv, unzip } from './lib/gtfs.mjs'
import { simplify } from './lib/simplify.mjs'

const SOURCE = 'TransLink GTFS (SEQ and regional Queensland), data.qld.gov.au, CC BY 4.0'
const TOLERANCE = 0.00003 // degrees, ~3 m

const features = []
for (const [region, url] of Object.entries(FEEDS)) {
  const local = process.env.TRANSLINK_GTFS_DIR && join(process.env.TRANSLINK_GTFS_DIR, `${region}.zip`)
  const zip = local && existsSync(local) ? local : await download(url, `${region}.zip`)

  const routes = new Map()
  for (const r of parseCsv(unzip(zip, 'routes.txt'))) {
    const mode = MODES[r.route_type]
    if (mode && mode !== 'bus') routes.set(r.route_id, { code: r.route_id.replace(/-\d+$/, ''), mode, color: r.route_color })
  }
  const shapes = new Map()
  for (const t of parseCsv(unzip(zip, 'trips.txt'))) {
    const r = routes.get(t.route_id)
    if (!r || !t.shape_id) continue
    let s = shapes.get(t.shape_id)
    if (!s) shapes.set(t.shape_id, (s = { mode: r.mode, codes: new Set(), colors: new Map(), pts: [] }))
    s.codes.add(r.code)
    if (r.color) s.colors.set(r.color, (s.colors.get(r.color) ?? 0) + 1)
  }
  await eachRow(zip, 'shapes.txt', (p) => {
    const s = shapes.get(p.shape_id)
    if (s) s.pts.push([+p.shape_pt_sequence, +p.shape_pt_lon, +p.shape_pt_lat])
  })

  // Shapes differ mostly by stopping pattern, not by track. For each route keep
  // the longest shape, then only shapes that cover track it doesn't (~30 m grid).
  const cell = ([x, y]) => `${Math.round(x / 0.0003)},${Math.round(y / 0.0003)}`
  for (const s of shapes.values()) s.line = s.pts.sort((a, b) => a[0] - b[0]).map(([, x, y]) => [x, y])
  const byCode = new Map()
  for (const s of shapes.values())
    for (const c of s.codes) byCode.set(c, [...(byCode.get(c) ?? []), s])
  let count = 0
  for (const [code, list] of byCode) {
    const covered = new Set()
    const parts = []
    for (const s of [...list].sort((a, b) => b.line.length - a.line.length)) {
      const fresh = s.line.filter((p) => !covered.has(cell(p))).length
      if (parts.length && fresh < s.line.length * 0.02) continue
      s.line.forEach((p) => covered.add(cell(p)))
      parts.push(simplify(s.line, TOLERANCE).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]))
    }
    const colors = new Map()
    for (const s of list) for (const [c, n] of s.colors) colors.set(c, (colors.get(c) ?? 0) + n)
    const color = [...colors].sort((a, b) => b[1] - a[1])[0]?.[0]
    features.push({
      type: 'Feature',
      properties: { region, code, mode: list[0].mode, color: color ? `#${color}` : null },
      geometry: { type: 'MultiLineString', coordinates: parts },
    })
    count += parts.length
  }
  console.log(`${region}: ${byCode.size} train, tram and ferry routes, ${count} track lines`)
}

const json = JSON.stringify({ type: 'FeatureCollection', source: SOURCE, generated: new Date().toISOString().slice(0, 10), features })
writeFileSync(new URL('../public/transit-tracks.json', import.meta.url), json)
console.log(`transit-tracks.json: ${(json.length / 1024).toFixed(0)} KB raw, ${(gzipSync(json).length / 1024).toFixed(0)} KB gz`)
