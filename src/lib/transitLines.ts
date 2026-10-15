import { allRouteCodes, routeInfo, type LiveVehicle, type TransitAlert } from '../api/translink'
import { routesAtStops, type TimetableIndex } from '../api/timetables'
import type { TransitLine } from '../api/types'

/**
 * Links a TransLink status line to the GTFS-RT route codes it covers, using
 * TransLink's own data: trains by the official T-code mapping ("T1 Caboolture"),
 * other modes by route number ("F1", "L1") or official route name (bus status
 * lines are titled with the route's long name). Returns null when nothing in the
 * published route data matches, rather than guessing.
 */
export function lineMatcher(line: TransitLine): ((code: string) => boolean) | null {
  const name = line.name.trim().toLowerCase()
  const token = line.name.match(/^([TFLM]\d+)\b/)?.[1]
  const matches = (code: string) => {
    const r = routeInfo(code)
    if (!r) return false
    if (line.mode === 'train') return r.line?.toLowerCase() === name
    return (token != null && r.short === token) || r.long.trim().toLowerCase() === name
  }
  return knownCodes().some(matches) ? matches : null
}

let codes: string[] | null = null
function knownCodes() {
  codes ??= allRouteCodes()
  return codes
}

/** The string stored in alert settings when someone watches a line. */
export function lineWatchKey(line: TransitLine): string | null {
  return lineMatcher(line) ? line.name : null
}

export function alertsForCodes(alerts: TransitAlert[], match: (code: string) => boolean) {
  return alerts.filter((a) => a.routes.some(match))
}

export function vehiclesForCodes(vehicles: LiveVehicle[], match: (code: string) => boolean) {
  return vehicles.filter((v) => match(v.route))
}

export function lineSlug(line: TransitLine) {
  return `${line.mode}/${encodeURIComponent(line.name)}`
}

/**
 * Route codes whose published timetable belongs on a line's page. Queensland
 * Rail codes are origin + destination ("CAIP" = Caboolture → Ipswich) and the
 * official T-code mapping files each under its destination's line, so trains
 * starting at a line's outer terminus, or running through it (Nambour trains
 * at Caboolture), are listed under other lines. For trains, this adds every
 * train route that calls at the line's terminus: the station its routes most
 * often end at other than Brisbane City, as long as it also stops at every
 * station the line's own trains all stop at. TransLink's line timetables list
 * Nambour trains on T1 Caboolture, which stop everywhere from Caboolture in,
 * but not Gympie North trains, which run express past Morayfield to Dakabin.
 */
export function timetableCodes(codes: string[], index: TimetableIndex, mode: string): string[] {
  const r = index.regions.SEQ
  if (mode !== 'train' || !r) return codes
  const ends = new Map<string, number>()
  for (const c of codes) {
    if (!/^[A-Z]{4}$/.test(c) || c.endsWith('BR')) continue
    const st = r.finals[r.routes.indexOf(c)]
    if (st) ends.set(st, (ends.get(st) ?? 0) + 1)
  }
  const terminus = [...ends].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!terminus) return codes
  // Stations (parent "place_" ids, so both directions count) each route calls at.
  const stations = (code: string) => {
    const i = r.routes.indexOf(code).toString(36)
    return new Set(Object.keys(r.stops).filter((id) => id.startsWith('place_') && r.stops[id].split('.').includes(i)))
  }
  const own = codes.filter((c) => /^[A-Z]{4}$/.test(c)).map(stations)
  const core = own.length ? [...own[0]].filter((id) => own.every((s) => s.has(id))) : []
  const through = routesAtStops(index, 'SEQ', [terminus]).filter((c) => {
    if (codes.includes(c) || routeInfo(c)?.mode !== 'train') return false
    const s = stations(c)
    return core.every((id) => s.has(id))
  })
  return [...new Set([...codes, ...through])]
}
