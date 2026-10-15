import type { Gauge, GaugeReading } from '../api/bccGauges'
import { distanceKm, type LngLat } from './geo'

export function latestReading(g: Gauge): GaugeReading | null {
  return g.readings.at(-1) ?? null
}

/**
 * Change between the earliest and latest readings within `windowMs` of the
 * latest one. Null when the gauge reported only once in that window, so a
 * trend is only ever drawn between two real readings.
 */
export function changeWithin(g: Gauge, windowMs: number): { from: GaugeReading; to: GaugeReading; delta: number } | null {
  const to = latestReading(g)
  if (!to) return null
  const from = g.readings.find((r) => r.time >= to.time - windowMs)
  if (!from || from === to) return null
  return { from, to, delta: to.value - from.value }
}

/** Rain the gauge reported after `since` (the sum of its 5-minute readings), and how many readings that covers. */
export function rainfallSince(g: Gauge, since: number): { mm: number; readings: number } {
  let mm = 0
  let readings = 0
  for (const r of g.readings) {
    if (r.time <= since) continue
    mm += r.value
    readings++
  }
  return { mm: Math.round(mm * 10) / 10, readings }
}

/** Gauges of one kind within `km` of a point, nearest first. */
export function nearbyGauges(gauges: Gauge[], at: LngLat, km: number, kind: Gauge['kind']) {
  return gauges
    .filter((g) => g.kind === kind)
    .map((g) => ({ gauge: g, km: distanceKm(at, g.position) }))
    .filter((x) => x.km <= km)
    .sort((a, b) => a.km - b.km)
}
