import { z } from 'zod'
import type { Gauge, GaugeReading } from './gaugeTypes.js'

// Queensland's statewide stream gauges: the Department of Local Government, Water
// and Volunteers' Water Monitoring Information Portal (water-monitoring.information.qld.gov.au,
// CC BY 4.0), a Kisters web service. The latest telemetered stream water level
// (datasource AT, variable 100) comes from get_latest_ts_values, which answers a
// POST of the whole open network (about 400 stations) in around 20 seconds and
// rejects long GET URLs, so the app reads it through /qld-gauges (api/qld-gauges.ts,
// functions/qld-gauges.ts and the dev plugin in vite.config.ts). Heights are gauge
// heights in metres on each station's own datum, not AHD. The station list is
// public/qld-gauges.json, built by scripts/build-qld-gauges.mjs.

export const WMIP_SERVICE = 'https://water-monitoring.information.qld.gov.au/cgi/webservice.pl'
export const WMIP_PORTAL = 'https://water-monitoring.information.qld.gov.au/'

/** The web service request for the latest stream water level at each of `sites`, to POST to WMIP_SERVICE. */
export function latestHeightsRequest(sites: string[]): string {
  return JSON.stringify({
    function: 'get_latest_ts_values',
    version: '2',
    params: { site_list: sites.join(','), datasource: 'AT', trace_list: [{ varfrom: '100', varto: '100' }] },
  })
}

/**
 * Quality codes (data.qld.gov.au "Queensland Water Monitoring Hydrology Data",
 * wrm_wm_da_quality.csv) for values the portal derived rather than measured:
 * theoretical calculation, derived height or discharge, estimate, surrogate data,
 * and data not yet available. The app shows measured heights only.
 */
const DERIVED_QUALITY = new Set([50, 59, 60, 69, 136, 151])

/** Readings older than this are left out, as the council gauges keep 24 hours. */
const MAX_AGE_MS = 24 * 60 * 60_000

const Stations = z.object({
  stations: z.array(z.tuple([z.string(), z.string(), z.number(), z.number()])),
})

const Latest = z.object({
  return: z.record(
    z.string(),
    z.array(
      z.object({
        values: z.array(z.object({ v: z.string(), q: z.number(), time: z.string() })).optional(),
      }),
    ),
  ),
})

/** "20261016001500" in the portal's time zone (AEST, UTC+10, no daylight saving) to ms. */
function parseTime(t: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(t)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 10, +m[5], +m[6])
}

/**
 * Joins the built station list with the web service's latest values. Every
 * station is kept; one with no measured reading in the last 24 hours has no readings.
 */
export function parseQldGauges(stations: unknown, latest: unknown, now: number): Gauge[] {
  const list = Stations.parse(stations).stations
  const values = Latest.parse(latest).return
  return list.map(([id, name, lon, lat]) => {
    const readings: GaugeReading[] = []
    for (const trace of values[id] ?? []) {
      for (const r of trace.values ?? []) {
        const time = parseTime(r.time)
        const value = Number(r.v)
        if (!Number.isFinite(time) || !Number.isFinite(value) || DERIVED_QUALITY.has(r.q) || now - time > MAX_AGE_MS) continue
        readings.push({ time, value })
      }
    }
    readings.sort((a, b) => a.time - b.time)
    return { id, name, kind: 'stream', source: 'qld', unit: 'm', position: [lon, lat], readings }
  })
}
