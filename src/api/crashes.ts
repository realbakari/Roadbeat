import type { LngLat } from '../lib/geo'

// TMR's "Crash data from Queensland roads" on data.qld.gov.au, queried live
// through CKAN's SQL endpoint (CORS *). Every column is stored as text, so
// numbers are cast in SQL. Licensed CC BY 4.0, © State of Queensland (TMR).
const SQL = 'https://www.data.qld.gov.au/api/3/action/datastore_search_sql'
const RESOURCE = '"e88943c0-5968-4972-a15f-38e120d72ec0"'
export const CRASH_DATASET_URL = 'https://www.data.qld.gov.au/dataset/crash-data-from-queensland-roads'

/** Latest crash in the current release; the 12 months before it are preliminary. */
export const CRASH_DATA_END = '30 Jun 2025'
export const CRASH_FIRST_YEAR = 2001
export const CRASH_LAST_YEAR = 2025

export const SEVERITIES = ['Fatal', 'Hospitalisation', 'Medical treatment', 'Minor injury', 'Property damage only'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_COLOR: Record<Severity, string> = {
  Fatal: '#7f1d1d',
  Hospitalisation: '#dc2626',
  'Medical treatment': '#f97316',
  'Minor injury': '#eab308',
  'Property damage only': '#94a3b8',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  Fatal: 'Fatal',
  Hospitalisation: 'Hospitalised',
  'Medical treatment': 'Medical treatment',
  'Minor injury': 'Minor injury',
  'Property damage only': 'Property damage',
}

export interface CrashFilter {
  from: number
  to: number
  severities: Severity[]
}

export const DEFAULT_CRASH_FILTER: CrashFilter = {
  from: CRASH_LAST_YEAR - 4,
  to: CRASH_LAST_YEAR,
  // Property-damage-only crashes stopped being recorded after 2010.
  severities: ['Fatal', 'Hospitalisation', 'Medical treatment', 'Minor injury'],
}

const LNG = '"Crash_Longitude"::float'
const LAT = '"Crash_Latitude"::float'
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`
const num = (n: number) => {
  if (!Number.isFinite(n)) throw new Error('Bad number in crash query')
  return String(n)
}

async function query<T>(sql: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(`${SQL}?sql=${encodeURIComponent(sql)}`, { signal })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error('Crash data is unavailable right now.')
  return body.result.records as T[]
}

type Bbox = [west: number, south: number, east: number, north: number]

function where(bbox: Bbox, f: CrashFilter) {
  const [w, s, e, n] = bbox.map(num)
  return [
    `${LNG} between ${w} and ${e}`,
    `${LAT} between ${s} and ${n}`,
    `"Crash_Year"::int between ${num(f.from)} and ${num(f.to)}`,
    `"Crash_Severity" in (${f.severities.map(quote).join(',') || "''"})`,
  ].join(' and ')
}

export interface CrashGrid {
  cells: GeoJSON.FeatureCollection<GeoJSON.Point, { n: number; w: number }>
  total: number
}

/** Crash counts binned on a lng/lat grid, for the heatmap. */
export async function fetchCrashGrid(bbox: Bbox, cell: number, f: CrashFilter, signal?: AbortSignal): Promise<CrashGrid> {
  const c = num(cell)
  const rows = await query<{ x: number; y: number; n: string }>(
    `select round(${LNG}/${c})*${c} x, round(${LAT}/${c})*${c} y, count(*) n from ${RESOURCE} where ${where(bbox, f)} group by 1, 2`,
    signal,
  )
  const counts = rows.map((r) => Number(r.n))
  const max = Math.max(1, ...counts)
  return {
    total: counts.reduce((a, b) => a + b, 0),
    cells: {
      type: 'FeatureCollection',
      features: rows.map((r, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.x, r.y] },
        // Weight relative to the busiest cell in view, softened so quieter roads still show.
        properties: { n: counts[i], w: (counts[i] / max) ** 0.75 },
      })),
    },
  }
}

export const CRASH_POINT_CAP = 4000

export interface CrashPoints {
  points: GeoJSON.FeatureCollection<GeoJSON.Point, { severity: Severity; label: string }>
  capped: boolean
}

/** Individual crashes in view, most severe and most recent first. */
export async function fetchCrashPoints(bbox: Bbox, f: CrashFilter, signal?: AbortSignal): Promise<CrashPoints> {
  const rows = await query<{ x: number; y: number; s: Severity; yr: string; m: string; nat: string; st: string | null }>(
    `select ${LNG} x, ${LAT} y, "Crash_Severity" s, "Crash_Year" yr, "Crash_Month" m, "Crash_Nature" nat, "Crash_Street" st
     from ${RESOURCE} where ${where(bbox, f)}
     order by ${severityRank} desc, "Crash_Year"::int desc limit ${CRASH_POINT_CAP}`,
    signal,
  )
  return {
    capped: rows.length >= CRASH_POINT_CAP,
    points: {
      type: 'FeatureCollection',
      // Reverse so the most severe draw last (on top).
      features: rows.reverse().map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.x, r.y] },
        properties: {
          severity: r.s,
          label: [SEVERITY_LABEL[r.s] ?? r.s, r.nat, r.st, `${r.m.slice(0, 3)} ${r.yr}`].filter(Boolean).join(' · '),
        },
      })),
    },
  }
}

const severityRank = `case "Crash_Severity" ${SEVERITIES.map((s, i) => `when ${quote(s)} then ${SEVERITIES.length - i}`).join(' ')} else 0 end`

export interface CrashSummary {
  total: number
  bySeverity: Record<Severity, number>
  natures: [string, number][]
  dcaGroups: [string, number][]
  wet: number
  night: number
  from: string
  to: string
  radiusKm: number
}

const SECOND_HALF = ['July', 'August', 'September', 'October', 'November', 'December']

/** Crashes within `radiusKm` of a point over the five years to the end of the data. */
export async function fetchCrashSummary(at: LngLat, signal?: AbortSignal, radiusKm = 1): Promise<CrashSummary> {
  const [lng, lat] = at
  const dLat = radiusKm / 111.32
  const k = Math.cos((lat * Math.PI) / 180)
  const dLng = dLat / k
  const first = CRASH_LAST_YEAR - 5 // Jul 2020 – Jun 2025
  const rows = await query<{ s: Severity; nat: string; dca: string | null; surf: string; light: string }>(
    `select "Crash_Severity" s, "Crash_Nature" nat, "Crash_DCA_Group_Description" dca,
       "Crash_Road_Surface_Condition" surf, "Crash_Lighting_Condition" light
     from ${RESOURCE}
     where ${LNG} between ${num(lng - dLng)} and ${num(lng + dLng)}
       and ${LAT} between ${num(lat - dLat)} and ${num(lat + dLat)}
       and power((${LNG} - ${num(lng)}) * ${num(k)}, 2) + power(${LAT} - ${num(lat)}, 2) <= ${num(dLat * dLat)}
       and ("Crash_Year"::int > ${first} or ("Crash_Year"::int = ${first} and "Crash_Month" in (${SECOND_HALF.map(quote).join(',')})))
     limit 10000`,
    signal,
  )
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>
  const natures = new Map<string, number>()
  const dca = new Map<string, number>()
  let wet = 0
  let night = 0
  for (const r of rows) {
    if (r.s in bySeverity) bySeverity[r.s]++
    if (r.nat) natures.set(r.nat, (natures.get(r.nat) ?? 0) + 1)
    if (r.dca) {
      const g = r.dca.replace(/^\d+:\s*/, '')
      dca.set(g, (dca.get(g) ?? 0) + 1)
    }
    if (/wet/i.test(r.surf)) wet++
    if (/darkness/i.test(r.light)) night++
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 3)
  return {
    total: rows.length,
    bySeverity,
    natures: top(natures),
    dcaGroups: top(dca),
    wet,
    night,
    from: `Jul ${first}`,
    to: `Jun ${CRASH_LAST_YEAR}`,
    radiusKm,
  }
}
