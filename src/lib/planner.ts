import type { Stop, StopIndex } from '../api/stops'
import type { ScheduledStop, ScheduledTrip } from '../api/timetables'
import { modeOf } from '../api/translink'

/** A published service that runs from one stop to the other without a change. */
export interface DirectOption {
  key: string
  trip: ScheduledTrip
  from: ScheduledStop
  to: ScheduledStop
  fromIndex: number
  toIndex: number
}

/**
 * Every published trip on `trips` that picks up at one of `fromIds` and later
 * sets down at one of `toIds`. Times are exactly the timetable's; nothing is
 * estimated, so trips needing a change or a walk aren't listed.
 */
export function directOptions(trips: ScheduledTrip[], fromIds: Set<string>, toIds: Set<string>): DirectOption[] {
  const out: DirectOption[] = []
  for (const trip of trips) {
    const i = trip.stops.findIndex((s, k) => fromIds.has(s.stopId) && s.kind !== 'arrival' && k < trip.stops.length - 1)
    if (i < 0) continue
    const j = trip.stops.findIndex((s, k) => k > i && toIds.has(s.stopId) && s.kind !== 'pickup')
    if (j < 0) continue
    out.push({ key: trip.key, trip, from: trip.stops[i], to: trip.stops[j], fromIndex: i, toIndex: j })
  }
  return out.sort((a, b) => a.from.time - b.from.time || a.to.time - b.to.time)
}

/** One ride in a journey: board `trip` at `from`, get off at `to`. */
export type Leg = Omit<DirectOption, 'key'>

/** A journey of one or two published services; a change is always at the same station or stop. */
export interface Journey {
  key: string
  legs: Leg[]
  /** Published departure from the first stop and arrival at the last (ms). */
  dep: number
  arr: number
}

/** Shortest change the planner offers: the next service must leave at least a minute after the published arrival. */
const MIN_CHANGE = 60_000
/** Longest wait it will consider at the change. */
const MAX_WAIT = 90 * 60_000

/**
 * Direct services plus journeys with one change, built only from TransLink's
 * published stop times. A change is offered only at the same station (any of
 * its platforms) or the same stop, where no walking time has to be guessed: the
 * change time shown is simply the gap between the published arrival and the
 * next service's published departure. Journeys that leave earlier and arrive
 * no sooner than another option are dropped, as journey planners do.
 */
export function planJourneys(trips: ScheduledTrip[], stops: StopIndex, fromIds: Set<string>, toIds: Set<string>): Journey[] {
  const region = trips[0]?.region
  const keyOf = new Map<string, string>()
  const place = (id: string) => {
    let k = keyOf.get(id)
    if (k == null) {
      const s = stops.get(region, id)
      keyOf.set(id, (k = s ? stops.station(s).id : id))
    }
    return k
  }
  const ends = new Set([...fromIds, ...toIds].map(place))

  // Second rides: every boarding that later reaches the destination, by place, soonest first.
  const onward = new Map<string, Leg[]>()
  for (const trip of trips) {
    const j = trip.stops.findIndex((s, k) => k > 0 && toIds.has(s.stopId) && s.kind !== 'pickup')
    for (let i = 0; i < j; i++) {
      const s = trip.stops[i]
      if (s.kind === 'arrival' || fromIds.has(s.stopId)) continue
      const k = place(s.stopId)
      if (ends.has(k)) continue
      let list = onward.get(k)
      if (!list) onward.set(k, (list = []))
      list.push({ trip, from: s, to: trip.stops[j], fromIndex: i, toIndex: j })
    }
  }
  for (const list of onward.values()) list.sort((a, b) => a.from.time - b.from.time)

  const out: Journey[] = directOptions(trips, fromIds, toIds).map((o) => ({
    key: o.key,
    legs: [o],
    dep: o.from.time,
    arr: o.to.arrival,
  }))

  for (const trip of trips) {
    const f = trip.stops.findIndex((s, k) => fromIds.has(s.stopId) && s.kind !== 'arrival' && k < trip.stops.length - 1)
    if (f < 0) continue
    let best: Journey | null = null
    for (let k = f + 1; k < trip.stops.length; k++) {
      const s = trip.stops[k]
      if (toIds.has(s.stopId)) break // a direct ride already covers this
      if (s.kind === 'pickup') continue
      const list = onward.get(place(s.stopId))
      if (!list) continue
      const ready = s.arrival + MIN_CHANGE
      let lo = 0
      let hi = list.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (list[mid].from.time < ready) lo = mid + 1
        else hi = mid
      }
      for (let n = lo; n < list.length && list[n].from.time - s.arrival <= MAX_WAIT; n++) {
        const second = list[n]
        if (second.trip === trip) continue
        if (best && second.from.time >= best.arr) break
        const arr = second.to.arrival
        // Earliest arrival; on a tie, the longer change.
        if (!best || arr < best.arr || (arr === best.arr && second.from.time - s.arrival > changeTime(best))) {
          best = {
            key: `${trip.key}>${second.trip.key}`,
            legs: [{ trip, from: trip.stops[f], to: s, fromIndex: f, toIndex: k }, second],
            dep: trip.stops[f].time,
            arr,
          }
        }
      }
    }
    if (best) out.push(best)
  }

  // Keep only journeys no other option beats: leaving later (or as late) and arriving sooner.
  out.sort((a, b) => b.dep - a.dep || a.arr - b.arr || a.legs.length - b.legs.length)
  const kept: Journey[] = []
  let soonest = Infinity
  for (const j of out) {
    if (j.arr < soonest) {
      kept.push(j)
      soonest = j.arr
    }
  }
  return kept.reverse()
}

/** Minutes between the published arrival of the first ride and the departure of the second. */
export function changeTime(j: Journey) {
  return j.legs.length > 1 ? j.legs[1].from.time - j.legs[0].to.arrival : 0
}

/** A stop plus, for a station, all of its platforms. */
export function stopAndChildren(stops: StopIndex, s: Stop) {
  return new Set([s.id, ...stops.children(s).map((c) => c.id)])
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Stations and stops whose name (or stop number) matches `query`, best first. Platforms are left to their station. */
export function searchStops(stops: StopIndex, query: string, limit = 8): Stop[] {
  const q = norm(query)
  if (q.length < 2) return []
  const scored: { s: Stop; score: number }[] = []
  for (const s of stops.all()) {
    if (s.parent) continue
    const n = norm(s.name)
    const at = n.indexOf(q)
    const byId = s.id === q
    if (at < 0 && !byId) continue
    const station = stops.children(s).length > 0 || / station$/i.test(s.name)
    scored.push({ s, score: (byId ? 0 : at === 0 ? 1 : n.includes(` ${q}`) ? 2 : 3) - (station ? 0.5 : 0) })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.s.name.length - b.s.name.length)
    .slice(0, limit)
    .map((x) => x.s)
}

/**
 * TransLink's own journey planner with this search filled in. Station ids
 * ("place_censta") are what its URL takes; other stops go by name only, for the
 * rider to confirm there.
 */
export function translinkPlannerUrl(from: Stop | null, to: Stop | null, date: string, minutes: number, arrive: boolean) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const time = `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  const p = new URLSearchParams({ searchDate: date, searchTime: time, timeSearchMode: arrive ? 'ArriveBefore' : 'LeaveAfter' })
  for (const [k, s] of [['start', from], ['end', to]] as const) {
    if (!s) continue
    p.set(k, s.name)
    if (s.id.startsWith('place_')) p.set(`${k}LocationId`, `ST:${s.id}`)
  }
  return `https://jp.translink.com.au/plan-your-journey/journey-planner?${p}`
}

/** A stop or headsign without its trailing " station", which the line and mode already say. */
export function shortName(name: string) {
  return name.replace(/ station$/i, '')
}

/** The mode a leg rides, from the published route; buses where the route isn't listed. */
export function legMode(l: Leg) {
  return modeOf(l.trip.route, l.trip.region)
}
