import { z } from 'zod'
import { parseSimpleCsv } from '../lib/csv'
import type { LngLat } from '../lib/geo'

// Brisbane City Council rainfall and stream height gauges
// (data.brisbane.qld.gov.au "Telemetry sensors — Rainfall and Stream heights"
// and its metadata, CC BY 4.0). The council's gauges feed the Bureau of
// Meteorology's flood warnings. Readings come every 5 minutes over a rolling
// 72 hours, one column per gauge; "-" means the gauge sent nothing for that
// interval. Some gauges report only every few hours.

const BASE = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets'
export const GAUGES_DATASET_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/telemetry-sensors-rainfall-and-stream-heights/'
/** 24 hours of 5-minute rows. */
const ROWS = 288

export interface GaugeReading {
  /** When the gauge measured it (ms). */
  time: number
  value: number
}

export interface Gauge {
  /** Sensor id, e.g. "E1594". */
  id: string
  name: string
  /** Stream height in metres above the Australian Height Datum, or rainfall in mm per 5 minutes. */
  kind: 'stream' | 'rain'
  unit: string
  position: LngLat
  /** Readings over the last 24 hours, oldest first. Intervals with no report are left out. */
  readings: GaugeReading[]
}

const Sensor = z.object({
  sensor_id: z.string(),
  location_name: z.string(),
  sensor_type: z.string(),
  unit_of_measure: z.string(),
  latitude: z.number(),
  longitude: z.number(),
})

/** Joins the gauge list with the readings table. Gauges with no position are skipped. */
export function parseGauges(sensors: unknown, readingsCsv: string): Gauge[] {
  const rows = parseSimpleCsv(readingsCsv)
  const out: Gauge[] = []
  for (const raw of z.array(z.unknown()).parse(sensors)) {
    const s = Sensor.safeParse(raw)
    if (!s.success) continue
    const col = s.data.sensor_id.toLowerCase()
    const readings: GaugeReading[] = []
    for (const r of rows) {
      const v = r[col]
      const time = Date.parse(r.measured)
      if (v == null || v === '' || v === '-' || !Number.isFinite(time)) continue
      const value = Number(v)
      if (Number.isFinite(value)) readings.push({ time, value })
    }
    readings.sort((a, b) => a.time - b.time)
    out.push({
      id: s.data.sensor_id,
      name: s.data.location_name.trim(),
      kind: s.data.sensor_type.toLowerCase().startsWith('stream') ? 'stream' : 'rain',
      unit: s.data.unit_of_measure,
      position: [s.data.longitude, s.data.latitude],
      readings,
    })
  }
  return out
}

let sensors: Promise<unknown> | null = null

export async function fetchGauges(signal?: AbortSignal): Promise<Gauge[]> {
  sensors ??= fetch(`${BASE}/telemetry-sensors-rainfall-and-stream-heights-metadata/exports/json`).then((r) => {
    if (!r.ok) throw new Error(`Gauge list responded with ${r.status}`)
    return r.json()
  })
  const [list, csv] = await Promise.all([
    sensors.catch((e) => {
      sensors = null
      throw e
    }),
    fetch(`${BASE}/telemetry-sensors-rainfall-and-stream-heights/exports/csv?order_by=measured%20desc&limit=${ROWS}&delimiter=,`, {
      signal,
      cache: 'no-cache',
    }).then((r) => {
      if (!r.ok) throw new Error(`Gauge readings responded with ${r.status}`)
      return r.text()
    }),
  ])
  return parseGauges(list, csv)
}
