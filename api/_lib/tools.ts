import type { FireWarning } from '../../src/api/bushfireFeed.js'
import type { Stop, StopIndex, TripIndex } from '../../src/api/stops.js'
import type { LiveVehicle, TransitRegion, TripUpdates } from '../../src/api/transitTypes.js'
import type { TrafficEvent } from '../../src/api/types.js'
import { BRISBANE_OFFSET_MS } from '../../src/lib/aest.js'
import { departuresAt } from '../../src/lib/departures.js'
import { hasEnded, isClosure, isUpcoming } from '../../src/lib/eventStatus.js'

// What Roadbeat's public API and MCP server answer. Pure: each function takes
// the official data and returns plain JSON, so the REST endpoints and the MCP
// tools give identical answers and can be tested with fixtures.

export const SITE = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://www.roadbeat.app')

/** A time as an ISO 8601 string in Brisbane time (UTC+10, no daylight saving). */
export function brisbaneIso(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null
  return new Date(ms + BRISBANE_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, '+10:00')
}

const words = (q: string | undefined) =>
  (q ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
const matchesAll = (haystack: string, q: string[]) => q.every((w) => haystack.includes(w))
const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)

export interface RoadEventQuery {
  query?: string
  district?: string
  type?: string
  closuresOnly?: boolean
  includeUpcoming?: boolean
  limit?: number
}

/** QLDTraffic road events matching a search, highest priority and most recent first. */
export function searchRoadEvents(events: TrafficEvent[], q: RoadEventQuery, fetchedAt: number) {
  const now = fetchedAt
  const terms = words(q.query)
  const rank = { 'Red Alert': 0, High: 1, Medium: 2, Low: 3 } as Record<string, number>
  const matching = events.filter((e) => {
    const p = e.properties
    if (!q.includeUpcoming && (isUpcoming(e, now) || hasEnded(e, now))) return false
    if (q.closuresOnly && !isClosure(e)) return false
    if (q.type && p.event_type.toLowerCase() !== q.type.toLowerCase()) return false
    if (q.district && (p.road_summary?.district ?? '').toLowerCase() !== q.district.toLowerCase()) return false
    if (!terms.length) return true
    const r = p.road_summary
    const text = [r?.road_name, r?.locality, r?.district, r?.local_government_area, r?.postcode, p.description, p.event_subtype, p.impact?.towards]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return matchesAll(text, terms)
  })
  const time = (e: TrafficEvent) => Date.parse(e.properties.last_updated ?? '') || 0
  matching.sort((a, b) => (rank[a.properties.event_priority] ?? 9) - (rank[b.properties.event_priority] ?? 9) || time(b) - time(a))
  return {
    source: 'Queensland Department of Transport and Main Roads, QLDTraffic (CC BY 4.0)',
    fetched_at: brisbaneIso(fetchedAt),
    total_matching: matching.length,
    events: matching.slice(0, q.limit ?? 20).map((e) => {
      const p = e.properties
      return {
        id: p.id,
        type: p.event_type,
        subtype: clean(p.event_subtype),
        priority: p.event_priority,
        road: clean(p.road_summary?.road_name),
        locality: clean(p.road_summary?.locality),
        district: clean(p.road_summary?.district),
        road_closed: isClosure(e),
        impact: clean(p.impact?.impact_subtype) ?? clean(p.impact?.impact_type),
        direction: clean(p.impact?.direction),
        description: clean(p.description),
        advice: clean(p.advice),
        starts: p.duration?.start ?? null,
        ends: p.duration?.end ?? null,
        last_updated: p.last_updated,
        link: `${SITE}/#event/${p.id}`,
      }
    }),
  }
}

const isStation = (index: StopIndex, s: Stop) => !s.parent && index.children(s).length > 0

/** TransLink stops and stations whose name contains every word of the query; stations first, then shortest names. */
export function findStops(index: StopIndex, query: string, region: TransitRegion | undefined, limit = 10) {
  const terms = words(query)
  if (!terms.length) return []
  const found: Stop[] = []
  for (const s of index.all()) {
    if (region && s.region !== region) continue
    if (s.parent) continue // platforms are listed under their station
    if (s.id.toLowerCase() === query.toLowerCase() || matchesAll(s.name.toLowerCase(), terms)) found.push(s)
  }
  found.sort((a, b) => Number(isStation(index, b)) - Number(isStation(index, a)) || a.name.length - b.name.length || a.name.localeCompare(b.name))
  return found.slice(0, limit).map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    kind: isStation(index, s) ? 'station' : 'stop',
    platforms: index.children(s).length || undefined,
    link: `${SITE}/#transit/stop/${s.region}/${encodeURIComponent(s.id)}`,
  }))
}

/** A stop by exact id, else the best name match. */
export function resolveStop(index: StopIndex, stop: string, region: TransitRegion | undefined): Stop | null {
  for (const r of region ? [region] : (['SEQ', 'CNS'] as const)) {
    const exact = index.get(r, stop)
    if (exact) return exact
  }
  const best = findStops(index, stop, region, 1)[0]
  return best ? index.get(best.region, best.id) : null
}

export interface Realtime {
  updates: TripUpdates
  vehicles: LiveVehicle[]
}

type RouteInfo = (code: string, region: TransitRegion) => { short: string; long: string; line?: string } | null

/** Next departures from a stop or station, from TransLink's real-time feed. */
export function nextDepartures(
  stop: Stop,
  index: StopIndex,
  trips: TripIndex,
  rt: Realtime,
  routeInfo: RouteInfo,
  opts: { route?: string; limit?: number; now: number },
) {
  const ids = new Set([stop.id, ...index.children(stop).map((c) => c.id)])
  const routeQ = opts.route?.toLowerCase().trim()
  const list = departuresAt({ updates: rt.updates, vehicles: rt.vehicles, trips, now: opts.now }, stop.region, ids, 200)
    .filter((d) => {
      if (!routeQ) return true
      const info = routeInfo(d.trip.route, d.trip.region)
      return [d.trip.route, info?.short, info?.line, info?.line?.split(' ')[0]].some((x) => x?.toLowerCase() === routeQ)
    })
    .slice(0, opts.limit ?? 10)
  return {
    source: 'Translink GTFS-RT real-time feed (CC BY 4.0)',
    note: "Times are TransLink's real-time predictions for services running now or starting soon. A delay counts as tracked only when a vehicle on that trip reports its position; otherwise the time is the timetable.",
    feed_time: brisbaneIso(rt.updates.at[stop.region]),
    stop: { id: stop.id, name: stop.name, region: stop.region, link: `${SITE}/#transit/stop/${stop.region}/${encodeURIComponent(stop.id)}` },
    departures: list.map((d) => {
      const info = routeInfo(d.trip.route, d.trip.region)
      const cancelled = d.trip.relationship === 'cancelled'
      return {
        route: info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route,
        line: info?.line ?? null,
        headsign: d.headsign,
        platform: index.get(d.trip.region, d.stopId)?.platform ?? null,
        scheduled: brisbaneIso(d.scheduled ?? d.time),
        expected: cancelled ? null : brisbaneIso(d.time),
        minutes_away: cancelled ? null : Math.max(0, Math.round((d.time - opts.now) / 60_000)),
        delay_minutes: d.vehicle && d.delay != null ? Math.round(d.delay / 60) : null,
        status: cancelled ? 'cancelled' : d.vehicle ? 'tracked' : 'scheduled',
      }
    }),
  }
}

/** Queensland Fire Department warnings and incidents, optionally by level or place. */
export function searchBushfires(fires: FireWarning[], q: { level?: string; query?: string; limit?: number }, fetchedAt: number) {
  const terms = words(q.query)
  const matching = fires.filter(
    (f) =>
      (!q.level || f.level.toLowerCase() === q.level.toLowerCase()) &&
      (!terms.length || matchesAll([f.title, f.area, f.location].filter(Boolean).join(' ').toLowerCase(), terms)),
  )
  return {
    source: 'Queensland Fire Department current bushfire incidents and warnings (CC BY 4.0)',
    note: 'In an emergency call Triple Zero (000). Check qldfireandrescue.qld.gov.au for the full warning.',
    fetched_at: brisbaneIso(fetchedAt),
    total_matching: matching.length,
    warnings: matching.slice(0, q.limit ?? 20).map((f) => ({
      id: f.id,
      level: f.level,
      title: f.title,
      location: f.location ?? f.area,
      status: f.status,
      call_to_action: f.callToAction,
      issued: brisbaneIso(f.issued),
      expires: brisbaneIso(f.expires),
      link: `${SITE}/#fire/${encodeURIComponent(f.id)}`,
    })),
  }
}
