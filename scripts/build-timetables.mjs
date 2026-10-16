// Builds the published timetables from TransLink's GTFS (SEQ and every regional
// network) as one
// small file per route, fetched only when a line or stop page needs it:
//  - public/timetables/<region>/<route>.json  every trip on that route over the
//                                             feed's calendar window
//  - public/timetables/index.json             feed window, routes (with the station
//                                             most of their trips end at), and
//                                             which routes serve each stop and station
// Every time is copied from stop_times.txt (departure_time and, where it
// differs, arrival_time, to the minute, as TransLink publishes them); nothing is
// interpolated or estimated. Stops a trip
// passes without stopping (pickup_type and drop_off_type both 1) are left out.
//
// Route file layout (compact, decoded by src/api/timetables.ts):
//   stops     stop ids used by this route
//   heads     official headsigns
//   services  days each service runs, as a hex bitmask over the feed window
//             (bit i = start + i days)
//   patterns  [direction, stops, offsets, flags, dwell?]: stop indexes in
//             order, each stop's departure in minutes after the first stop, a
//             string with one character per stop: "0" normal, "d" drop-off only
//             (arrival), "p" pick-up only; and, only when some stop's published
//             arrival is earlier than its departure, the minutes between them
//   trips     [pattern, first departure in minutes after the service day's
//             midnight, service, headsign, trip number] — sorted by pattern
//             then time. The trip number is the leading number of the GTFS
//             trip id, which is what real-time TripUpdates are matched on.
//
// Run with `npm run data:timetables` when TransLink publishes a new timetable. Needs `unzip`.
// Set TRANSLINK_GTFS_DIR to a folder holding SEQ.zip, CNS.zip, TSV.zip… to skip the download.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { FEEDS, download, eachRow, parseCsv, unzip } from './lib/gtfs.mjs'

const SOURCE = 'TransLink GTFS (SEQ and regional Queensland), data.qld.gov.au, CC BY 4.0'
const OUT = new URL('../public/timetables/', import.meta.url)
const DAY = 86_400_000

const ymd = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))
const minutes = (t) => {
  const [h, m] = t.split(':')
  return +h * 60 + +m
}
const FLAG = { '00': '0', '10': 'd', '01': 'p' }

rmSync(OUT, { recursive: true, force: true })
const index = { source: SOURCE, generated: new Date().toISOString().slice(0, 10), regions: {} }
const sizes = []

for (const [region, url] of Object.entries(FEEDS)) {
  const local = process.env.TRANSLINK_GTFS_DIR && join(process.env.TRANSLINK_GTFS_DIR, `${region}.zip`)
  const zip = local && existsSync(local) ? local : await download(url, `${region}.zip`)

  // Service calendars → the set of dates each service runs.
  const calendar = parseCsv(unzip(zip, 'calendar.txt'))
  const exceptions = parseCsv(unzip(zip, 'calendar_dates.txt'))
  const dates = [...calendar.flatMap((c) => [c.start_date, c.end_date]), ...exceptions.map((e) => e.date)].map(ymd)
  const start = Math.min(...dates)
  const days = (Math.max(...dates) - start) / DAY + 1
  const runs = new Map()
  const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (const c of calendar) {
    const on = runs.get(c.service_id) ?? new Set()
    for (let d = ymd(c.start_date); d <= ymd(c.end_date); d += DAY)
      if (c[WEEK[new Date(d).getUTCDay()]] === '1') on.add((d - start) / DAY)
    runs.set(c.service_id, on)
  }
  for (const e of exceptions) {
    const on = runs.get(e.service_id) ?? new Set()
    const i = (ymd(e.date) - start) / DAY
    if (e.exception_type === '1') on.add(i)
    else on.delete(i)
    runs.set(e.service_id, on)
  }
  const bits = (on) => {
    let hex = ''
    for (let i = 0; i < days; i += 4) {
      let n = 0
      for (let b = 0; b < 4; b++) if (on.has(i + b)) n |= 1 << b
      hex += n.toString(16)
    }
    return hex
  }

  const parentOf = new Map(parseCsv(unzip(zip, 'stops.txt')).map((s) => [s.stop_id, s.parent_station || s.stop_id]))

  const tripInfo = new Map()
  for (const t of parseCsv(unzip(zip, 'trips.txt'))) {
    tripInfo.set(t.trip_id, {
      code: t.route_id.replace(/-\d+$/, ''),
      service: t.service_id,
      head: t.trip_headsign.trim(),
      dir: Number(t.direction_id) || 0,
      n: Number(t.trip_id.split('-')[0]),
      stops: [],
    })
  }
  await eachRow(zip, 'stop_times.txt', (r) => {
    const t = tripInfo.get(r.trip_id)
    const flag = FLAG[(r.pickup_type || '0') + (r.drop_off_type || '0')]
    if (!t || !flag) return
    const dep = minutes(r.departure_time || r.arrival_time)
    t.stops.push([+r.stop_sequence, r.stop_id, dep, flag, dep - minutes(r.arrival_time || r.departure_time)])
  })

  const routes = new Map()
  for (const t of tripInfo.values()) {
    if (t.stops.length < 2 || !Number.isFinite(t.n)) continue
    t.stops.sort((a, b) => a[0] - b[0])
    let r = routes.get(t.code)
    if (!r) routes.set(t.code, (r = []))
    r.push(t)
  }

  mkdirSync(new URL(`${region}/`, OUT), { recursive: true })
  const servedBy = new Map()
  const routeList = []
  const finals = []
  for (const [code, trips] of [...routes].sort((a, b) => a[0].localeCompare(b[0]))) {
    const table = () => {
      const list = []
      const at = new Map()
      return { list, of: (v) => (at.has(v) ? at.get(v) : (at.set(v, list.length), list.push(v), list.length - 1)) }
    }
    const stops = table(), heads = table(), services = table(), patterns = table()
    const rows = []
    for (const t of trips) {
      const first = t.stops[0][2]
      const p = patterns.of(
        JSON.stringify([
          t.dir,
          t.stops.map((s) => stops.of(s[1])),
          t.stops.map((s) => s[2] - first),
          t.stops.map((s) => s[3]).join(''),
          ...(t.stops.some((s) => s[4]) ? [t.stops.map((s) => s[4])] : []),
        ]),
      )
      rows.push([p, first, services.of(bits(runs.get(t.service) ?? new Set())), heads.of(t.head), t.n])
    }
    rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[4] - b[4])
    for (const s of new Set(stops.list.flatMap((s) => [s, parentOf.get(s) ?? s]))) {
      let set = servedBy.get(s)
      if (!set) servedBy.set(s, (set = new Set()))
      set.add(routeList.length)
    }
    // The station most of this route's trips end at.
    const ends = new Map()
    for (const t of trips) {
      const st = parentOf.get(t.stops[t.stops.length - 1][1]) ?? t.stops[t.stops.length - 1][1]
      ends.set(st, (ends.get(st) ?? 0) + 1)
    }
    finals.push([...ends].sort((a, b) => b[1] - a[1])[0][0])
    routeList.push(code)
    const json = JSON.stringify({
      region,
      route: code,
      start: new Date(start).toISOString().slice(0, 10),
      days,
      stops: stops.list,
      heads: heads.list,
      services: services.list,
      patterns: patterns.list.map((p) => JSON.parse(p)),
      trips: rows,
    })
    writeFileSync(new URL(`${region}/${code}.json`, OUT), json)
    sizes.push({ file: `${region}/${code}`, raw: json.length, gz: gzipSync(json).length, trips: trips.length })
  }

  // Stop → routes, so a stop page knows which route files to fetch.
  const served = {}
  for (const [stop, set] of servedBy) served[stop] = [...set].sort((a, b) => a - b).map((i) => i.toString(36)).join('.')
  index.regions[region] = { start: new Date(start).toISOString().slice(0, 10), days, routes: routeList, finals, stops: served }
  console.log(`${region}: ${routeList.length} routes, ${tripInfo.size} trips, ${days} days from ${index.regions[region].start}`)
}

const json = JSON.stringify(index)
writeFileSync(new URL('index.json', OUT), json)
const kb = (n) => `${(n / 1024).toFixed(0)} KB`
sizes.sort((a, b) => b.gz - a.gz)
console.log(`index.json: ${kb(json.length)} raw, ${kb(gzipSync(json).length)} gz`)
console.log(`routes: ${kb(sizes.reduce((s, x) => s + x.raw, 0))} raw, ${kb(sizes.reduce((s, x) => s + x.gz, 0))} gz total`)
console.log(`largest (gz): ${sizes.slice(0, 8).map((s) => `${s.file} ${kb(s.gz)}`).join(', ')}`)
console.log(`median route: ${kb(sizes[sizes.length >> 1].gz)} gz`)
