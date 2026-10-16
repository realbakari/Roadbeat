import type { AirReading } from '../api/airHistory'

const HOUR = 3_600_000

/** Runs of consecutive hours, so a missing hour shows as a break in a chart's line rather than being bridged. */
export function segments(readings: AirReading[], pick: (r: AirReading) => number | null): [number, number][][] {
  const out: [number, number][][] = []
  let last: number | null = null
  for (const r of readings) {
    const v = pick(r)
    if (v == null) {
      last = null
      continue
    }
    if (last == null || r.time - last > HOUR) out.push([])
    out[out.length - 1].push([r.time, v])
    last = r.time
  }
  return out
}

/** Axis labels: whole numbers once values reach 100, else one or two decimals. */
export function axisLabel(v: number): string {
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)
}
