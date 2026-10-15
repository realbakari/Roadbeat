import { z } from 'zod'
import type { LngLat } from '../lib/geo'

// Low clearance bridges and structures, from two Brisbane City Council
// datasets (data.brisbane.qld.gov.au, CC BY 4.0):
// - "Road height restrictions — Brisbane City Council": council structures
//   with a signed clearance of 4.6 m or less, each with the date the council
//   validated it.
// - "Road height restrictions — Queensland Rail": Queensland Rail bridges in
//   South East Queensland, a point-in-time extract the council republishes.
//   Rows carry no date; the dataset's "temporal coverage from" metadata is the
//   date Queensland Rail's extract was taken.
// The council's API sends CORS headers, so the browser reads it directly. The
// app shows each clearance exactly as published and never rounds it.

const BASE = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets'
// The exports endpoint returns every row as a plain array (the records API stops at 100).
const BCC_API = `${BASE}/road-restrictions/exports/json`
const QR_API = `${BASE}/road-restrictions-qr/exports/json`
const QR_META = `${BASE}/road-restrictions-qr`
export const BCC_CLEARANCES_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/road-restrictions/information/'
export const QR_CLEARANCES_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/road-restrictions-qr/information/'
/** Queensland Rail's own page on rail bridge strikes and clearances. */
export const QR_BRIDGES_URL = 'https://www.queenslandrail.com.au/forcustomers/safetysecurity/railbridges'

export interface Clearance {
  /** Stable id for links: "bcc-<restriction id>" or "qr-<lat>,<lng>" (the Queensland Rail rows have no id). */
  id: string
  source: 'bcc' | 'qr'
  position: LngLat
  /** Signed clearance in metres, as published. */
  metres: number
  /** The structure: the council's description, or the street under a Queensland Rail bridge. */
  title: string
  suburb: string | null
  /** Queensland Rail's category, such as "Low clearance <4.6m". */
  category: string | null
  owner: string | null
  ownerPhone: string | null
  roadOwner: string | null
  roadOwnerPhone: string | null
  /** YYYY-MM-DD: when the council validated the row, or the date of Queensland Rail's extract. */
  dated: string | null
}

const text = z.string().nullish().transform((s) => (s && s.trim() ? s.trim() : null))
const date = text.transform((s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null))
const lat = z.number().min(-90).max(90)
const lng = z.number().min(-180).max(180)
const metres = z.number().positive()

const BccRow = z.object({
  restriction_id: z.string().min(1),
  lat,
  long: lng,
  signed_clearance_min: metres,
  description: text,
  structure_owner: text,
  structure_owner_contact_details: text,
  road_owner: text,
  road_owner_contact_details: text,
  validation_date: date,
})

const QrRow = z.object({
  latitude: lat,
  longitude: lng,
  road_clearance_m: metres,
  street: text,
  suburb: text,
  clearance_category: text,
  structure_owner: text,
  structure_owner_contact: text,
})

const Body = z.array(z.unknown())

/** Parses each row on its own, so one malformed row is skipped rather than hiding the rest. */
function rows<T>(json: unknown, row: z.ZodType<T>): T[] {
  return Body.parse(json).flatMap((r) => {
    const p = row.safeParse(r)
    return p.success ? [p.data] : []
  })
}

export function parseBccClearances(json: unknown): Clearance[] {
  return rows(json, BccRow).map((r) => ({
    id: `bcc-${r.restriction_id}`,
    source: 'bcc',
    position: [r.long, r.lat],
    metres: r.signed_clearance_min,
    title: r.description ?? r.restriction_id,
    suburb: null,
    category: null,
    owner: r.structure_owner,
    ownerPhone: r.structure_owner_contact_details,
    roadOwner: r.road_owner,
    roadOwnerPhone: r.road_owner_contact_details,
    dated: r.validation_date,
  }))
}

export function parseQrClearances(json: unknown, extractDate: string | null): Clearance[] {
  return rows(json, QrRow).map((r) => ({
    id: `qr-${r.latitude},${r.longitude}`,
    source: 'qr',
    position: [r.longitude, r.latitude],
    metres: r.road_clearance_m,
    title: r.street ?? 'Railway bridge',
    suburb: r.suburb,
    category: r.clearance_category,
    owner: r.structure_owner,
    ownerPhone: r.structure_owner_contact,
    roadOwner: null,
    roadOwnerPhone: null,
    dated: extractDate,
  }))
}

const Meta = z.object({
  metas: z.object({ custom: z.object({ 'data-temporal-coverage-from-custom': date }).partial().nullish() }),
})

/** The date Queensland Rail's extract was taken, from the dataset's metadata, or null if it isn't given. */
export function parseQrExtractDate(json: unknown): string | null {
  const p = Meta.safeParse(json)
  return p.success ? (p.data.metas.custom?.['data-temporal-coverage-from-custom'] ?? null) : null
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Brisbane City Council responded with ${res.status}`)
  return res.json()
}

/** Both datasets; the extract date is optional, so its request failing doesn't hide the bridges. */
export async function fetchClearances(signal?: AbortSignal): Promise<Clearance[]> {
  const [bcc, qr, meta] = await Promise.all([
    getJson(BCC_API, signal),
    getJson(QR_API, signal),
    getJson(QR_META, signal).catch(() => null),
  ])
  return [...parseBccClearances(bcc), ...parseQrClearances(qr, parseQrExtractDate(meta))]
}

/** The clearance as published, with its unit: 4.1 → "4.1 m". */
export function clearanceLabel(m: number) {
  return `${m} m`
}
