import { z } from 'zod'
import { parseSimpleCsv } from '../lib/csv'
import type { LngLat } from '../lib/geo'

// Brisbane City Council signalised intersections: live volumes
// (data.brisbane.qld.gov.au "Traffic Management — Intersection volume") and
// site locations (built into src/data by scripts/build-intersections.mjs),
// CC BY 4.0. Only council-operated signals are included.
//
// SCATS sends one row per approach per signal cycle. For each lane it gives the
// degree of saturation (dsN, the % of the cycle the lane's detector was
// occupied, measured) and measured flow (mfN, vehicles counted that cycle). It
// also sends rfN, a SCATS-calculated expected flow; that is an estimate, so the
// app does not read it. The council doesn't publish which street each
// approach ("SA-230") belongs to.

const VOLUMES =
  'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/traffic-data-at-intersection/exports/csv?select=tsc,lane,recorded,ct,ds1,mf1,ds2,mf2,ds3,mf3,ds4,mf4&delimiter=,'
export const SIGNALS_DATASET_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/traffic-data-at-intersection/'

export interface SignalSite {
  /** SCATS traffic signal number. */
  tsc: string
  suburb: string
  position: LngLat
  streets: string[]
}

export interface LaneReading {
  /** Degree of saturation as SCATS measured it, in % (can exceed 100). */
  ds: number
  /** Vehicles counted in the cycle. */
  vehicles: number
}

export interface ApproachReading {
  /** SCATS strategic approach id, e.g. "SA-230". */
  id: string
  recorded: number
  /** Signal cycle time in seconds. */
  cycle: number
  lanes: LaneReading[]
}

/** Each site's latest cycle per approach, keyed by SCATS number. */
export type SignalVolumes = Map<string, ApproachReading[]>

const SiteFile = z.object({ sites: z.array(z.tuple([z.string(), z.string(), z.number(), z.number(), z.array(z.string())])) })

let sites: Promise<SignalSite[]> | null = null
export function loadSignalSites(): Promise<SignalSite[]> {
  sites ??= import('../data/bcc-intersections.json').then((m) =>
    SiteFile.parse(m.default).sites.map(([tsc, suburb, lat, lng, streets]) => ({ tsc, suburb, position: [lng, lat], streets })),
  )
  return sites
}

const num = (v: string | undefined) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Keeps the latest row for each site and approach; lanes with no detector data are dropped. */
export function parseSignalVolumes(csv: string): SignalVolumes {
  const latest = new Map<string, { tsc: string; reading: ApproachReading }>()
  for (const r of parseSimpleCsv(csv)) {
    const recorded = Date.parse(r.recorded)
    if (!r.tsc || !r.lane || !Number.isFinite(recorded)) continue
    const key = `${r.tsc}|${r.lane}`
    const prev = latest.get(key)
    if (prev && prev.reading.recorded >= recorded) continue
    const lanes: LaneReading[] = []
    for (let n = 1; n <= 4; n++) {
      const ds = num(r[`ds${n}`])
      const vehicles = num(r[`mf${n}`])
      if (ds != null && vehicles != null) lanes.push({ ds, vehicles })
    }
    latest.set(key, { tsc: r.tsc, reading: { id: r.lane, recorded, cycle: num(r.ct) ?? 0, lanes } })
  }
  const out: SignalVolumes = new Map()
  for (const { tsc, reading } of latest.values()) {
    if (!reading.lanes.length) continue
    out.set(tsc, [...(out.get(tsc) ?? []), reading])
  }
  for (const list of out.values()) list.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
  return out
}

export async function fetchSignalVolumes(signal?: AbortSignal): Promise<SignalVolumes> {
  const res = await fetch(VOLUMES, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Intersection volumes responded with ${res.status}`)
  return parseSignalVolumes(await res.text())
}
