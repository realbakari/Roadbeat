// Japan's Himawari-9 weather satellite, every 10 minutes, from NASA's Global
// Imagery Browse Services (GIBS). It sees all of Queensland day and night. The
// tiles and each layer's DescribeDomains document answer CORS requests and need
// no key. GIBS answers 404 for a time it hasn't published and snaps a time
// between steps to the one before, so the time in the tile address is always
// one GIBS has listed, never the clock's.

import { aestWithAge } from '../lib/aest'

export type HimawariBand = 'infrared' | 'visible'

interface BandInfo {
  layer: string
  /** GIBS's tile matrix set, which caps the zoom it serves. */
  level: number
  /** How the band is named on screen. */
  label: string
}

export const HIMAWARI_BANDS: Record<HimawariBand, BandInfo> = {
  infrared: { layer: 'Himawari_AHI_Band13_Clean_Infrared', level: 6, label: 'infrared' },
  visible: { layer: 'Himawari_AHI_Band3_Red_Visible_1km', level: 7, label: 'visible' },
}

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

/** GIBS's acknowledgement wording, and the image's own source, which the Japan Meteorological Agency asks to be cited. */
export const HIMAWARI_CREDIT = 'Himawari-9 imagery: Japan Meteorological Agency, served by NASA GIBS (ESDIS)'
export const GIBS_ACKNOWLEDGEMENT =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."
export const JMA_COPYRIGHT = 'https://www.jma.go.jp/jma/en/copyright.html'

/** The tile address template for one published image time (ISO, UTC), for a MapLibre raster source. */
export function himawariTiles(band: HimawariBand, time: string): string {
  const { layer, level } = HIMAWARI_BANDS[band]
  return `${GIBS}/${layer}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`
}

/**
 * The band's DescribeDomains address for the UTC days either side of `now`.
 * The window has to end after now: GIBS cuts the last time range at the
 * window's end. GIBS's CDN keeps the document for up to 30 minutes
 * (max-age=1800), so the address carries the minute it is read in, which
 * GIBS ignores, to get the list as it is now.
 */
export function domainsUrl(band: HimawariBand, now: number): string {
  const { layer, level } = HIMAWARI_BANDS[band]
  const day = (offset: number) => new Date(now + offset * 86_400_000).toISOString().slice(0, 10)
  return `${GIBS}/1.0.0/${layer}/default/GoogleMapsCompatible_Level${level}/all/${day(-1)}--${day(1)}.xml?minute=${Math.floor(now / 60_000)}`
}

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/

/**
 * The newest image time a DescribeDomains document lists, as GIBS writes it
 * ("2026-10-17T13:10:00Z"), or null when it lists none. The time domain is a
 * comma-separated list of start/end/PT10M ranges, oldest first, so the newest
 * time is the last range's end. A bare date is midnight UTC.
 */
export function latestDomainTime(xml: string): string | null {
  const domain = /<Domain>([^<]*)<\/Domain>/.exec(xml)?.[1].trim()
  if (!domain) return null
  const last = domain.split(',').pop()!.trim().split('/')
  const end = last.length >= 2 ? last[1] : last[0]
  if (!ISO.test(end)) return null
  return end.includes('T') ? end : `${end}T00:00:00Z`
}

/**
 * The newer of two image times GIBS has listed. GIBS's servers don't all
 * list the same newest image at once (on 17 October 2026 some answered 13:10
 * while others answered 13:30), so a later read can name an older image; the
 * map keeps the newest one it has been told about rather than stepping back.
 */
export function newerTime(seen: string | null, read: string | null): string | null {
  if (!seen) return read
  if (!read) return seen
  return Date.parse(read) > Date.parse(seen) ? read : seen
}

/** The newest image GIBS has published for `band`, or null when it lists none in the last day. */
export async function latestHimawariTime(band: HimawariBand, now: number, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(domainsUrl(band, now), { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`NASA GIBS responded with ${res.status}`)
  return latestDomainTime(await res.text())
}

/** "Himawari-9 infrared, 11:20 pm AEST, 14 min ago", from the image time GIBS listed. */
export function himawariLabel(band: HimawariBand, time: string, now: number): string {
  const at = Date.parse(time)
  return `Himawari-9 ${HIMAWARI_BANDS[band].label}, ${aestWithAge(at, now)}`
}
