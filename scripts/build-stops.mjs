// Builds the stop and trip tables behind "Next departures" from TransLink's
// published GTFS (SEQ and Cairns), keeping them small enough to ship:
//  - src/data/translink-stops.json      train, tram and ferry stops (+ their stations)
//  - src/data/translink-stops-bus.json  every other stop, loaded only when needed
//  - src/data/translink-trips.json      trip → official headsign and direction, so a
//                                       GTFS-RT TripUpdate can say where it's going
// Times are never taken from here: departures come only from the real-time feed.
// Run with `npm run data:stops` when TransLink publishes a new timetable. Needs `unzip`.
// Set TRANSLINK_GTFS_DIR to a folder holding SEQ.zip and CNS.zip to skip the download.
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FEEDS, MODES, download, eachRow, parseCsv, unzip } from './lib/gtfs.mjs'

const SOURCE = 'TransLink GTFS (SEQ, Cairns), data.qld.gov.au, CC BY 4.0'
const round = (n) => Math.round(Number(n) * 1e5) / 1e5
const out = (name, data) => {
  const json = JSON.stringify({ source: SOURCE, generated: new Date().toISOString().slice(0, 10), ...data })
  writeFileSync(new URL(`../src/data/${name}`, import.meta.url), json)
  console.log(`${name}: ${(json.length / 1024).toFixed(0)} KB`)
}

const core = {}
const bus = {}
const trips = {}

for (const [region, url] of Object.entries(FEEDS)) {
  const local = process.env.TRANSLINK_GTFS_DIR && join(process.env.TRANSLINK_GTFS_DIR, `${region}.zip`)
  const zip = local && existsSync(local) ? local : await download(url, `${region}.zip`)

  const routeMode = new Map(parseCsv(unzip(zip, 'routes.txt')).map((r) => [r.route_id, MODES[r.route_type] ?? 'bus']))
  const tripRows = parseCsv(unzip(zip, 'trips.txt'))
  const tripMode = new Map(tripRows.map((t) => [t.trip_id, routeMode.get(t.route_id) ?? 'bus']))

  // Which modes serve each stop, from the timetable itself.
  const served = new Map()
  await eachRow(zip, 'stop_times.txt', (r) => {
    let s = served.get(r.stop_id)
    if (!s) served.set(r.stop_id, (s = new Set()))
    s.add(tripMode.get(r.trip_id))
  })

  const stops = parseCsv(unzip(zip, 'stops.txt'))
  const isCore = (id) => [...(served.get(id) ?? [])].some((m) => m !== 'bus')
  const coreParents = new Set(stops.filter((s) => isCore(s.stop_id) && s.parent_station).map((s) => s.parent_station))
  core[region] = []
  bus[region] = []
  for (const s of stops) {
    const station = s.location_type === '1'
    if (!station && !served.has(s.stop_id)) continue
    const row = [s.stop_id, s.stop_name.trim(), round(s.stop_lat), round(s.stop_lon), s.parent_station || 0, s.platform_code || 0]
    const inCore = station ? coreParents.has(s.stop_id) : isCore(s.stop_id)
    ;(inCore ? core : bus)[region].push(row)
  }

  // Trip ids look like "39241211-QR 26_27-44306-D145"; the leading number is unique
  // within a feed, so trips are stored as sorted base-36 deltas of that number.
  const headsigns = [...new Set(tripRows.map((t) => t.trip_headsign.trim()))]
  const hIndex = new Map(headsigns.map((h, i) => [h, i]))
  const sorted = tripRows
    .map((t) => ({ n: Number(t.trip_id.split('-')[0]), h: hIndex.get(t.trip_headsign.trim()), d: Number(t.direction_id) || 0 }))
    .filter((t) => Number.isFinite(t.n))
    .sort((a, b) => a.n - b.n)
  trips[region] = {
    headsigns,
    ids: sorted.map((t, i) => (t.n - (i ? sorted[i - 1].n : 0)).toString(36)).join(','),
    info: sorted.map((t) => (t.h * 2 + t.d).toString(36)).join(','),
  }
  console.log(`${region}: ${core[region].length} rail/tram/ferry stops, ${bus[region].length} bus stops, ${sorted.length} trips`)
}

out('translink-stops.json', { stops: core })
out('translink-stops-bus.json', { stops: bus })
out('translink-trips.json', { trips })
