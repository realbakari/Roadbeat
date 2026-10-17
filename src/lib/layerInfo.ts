import type { MapLayers } from '../components/map/settings'
import { FEEDS, type FeedId } from './feedRegistry'

// Each map layer's info line: who publishes it and how often the app reads it,
// taken from the feed registry (the same list /status and the data sources
// docs are built from), so the panel can't drift from them. Layers whose own
// note already gives this (bushfires, warnings, hotspots) aren't listed.

interface Source {
  feeds: FeedId[]
  /** Who publishes the layer, where the feed's publisher names more than the layer shows. */
  publisher?: string
}

const SOURCES: Partial<Record<keyof MapLayers, Source>> = {
  webcams: { feeds: ['cameras'] },
  floodcams: { feeds: ['cameras'] },
  restAreas: { feeds: ['rest-areas'] },
  dumpPoints: { feeds: ['rest-areas'] },
  trucks: { feeds: ['rest-areas'] },
  waze: { feeds: ['waze'] },
  radar: { feeds: ['rain-radar'] },
  crashes: { feeds: ['crashes'] },
  vehicles: { feeds: ['vehicles'] },
  gauges: { feeds: ['bcc-gauges', 'qld-gauges'] },
  signals: { feeds: ['signals'] },
  clearances: { feeds: ['clearances'] },
  clearways: { feeds: ['clearways'] },
  toilets: { feeds: ['toilets'] },
  accessibleParking: { feeds: ['accessible-parking'] },
  parkingMeters: { feeds: ['parking-meters'] },
  cycling: { feeds: ['bike-racks'] },
  councilEvents: { feeds: ['council-events'] },
  news: { feeds: ['news'] },
  councilCentres: { feeds: ['news'], publisher: 'Council disaster dashboards' },
  outages: { feeds: ['news'], publisher: 'Council disaster dashboards (power outages are Energex’s)' },
  airQuality: { feeds: ['air-quality'] },
  nswFires: { feeds: ['nsw-fires'] },
  cyclones: { feeds: ['jtwc'] },
  pastCyclones: { feeds: ['past-cyclones'] },
  speedCameras: { feeds: ['speed-cameras'] },
}

export interface LayerInfo {
  publisher: string
  cadence: string
}

function every(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds / 3600)} h`
}

/** The layer's publisher and read cadence, or null for a layer without one in the registry. */
export function layerInfo(key: keyof MapLayers): LayerInfo | null {
  const source = SOURCES[key]
  if (!source) return null
  const feeds = source.feeds.map((id) => FEEDS.find((f) => f.id === id)).filter((f) => f != null)
  if (!feeds.length) return null
  const first = feeds[0]
  const publisher = source.publisher ?? [...new Set(feeds.map((f) => f.publisher))].join(' and ')
  const cadence = first.refreshSeconds != null ? `Read every ${every(first.refreshSeconds)}${first.refreshNote ? ` (${first.refreshNote[0].toLowerCase()}${first.refreshNote.slice(1)})` : ''}` : (first.refreshNote ?? 'Read once per visit')
  return { publisher, cadence }
}

/** A layer's latest time: the publisher's own data time where the feed carries one, or else when the app last read it. */
export interface DataTime {
  at: number
  label: string
}

const newest = (times: number[]) => {
  const at = Math.max(0, ...times.filter(Number.isFinite))
  return at > 0 ? at : null
}

interface LayerData {
  gauges: { readings: { time: number }[] }[] | null
  airStations: { measuredAt: number }[] | null
  cyclones: { issuedAt: number }[] | null
  /** When the news snapshot (news, centres and outages) was read by Roadbeat's server. */
  newsReadAt: number | null
  nswReadAt: number | null
}

/** The latest time each layer can show, from the data loaded now. Layers with no time in their feed get none. */
export function layerTimes(d: LayerData): Partial<Record<keyof MapLayers, DataTime>> {
  const out: Partial<Record<keyof MapLayers, DataTime>> = {}
  const gauge = newest((d.gauges ?? []).flatMap((g) => g.readings.map((r) => r.time)))
  if (gauge) out.gauges = { at: gauge, label: 'Latest reading' }
  const air = newest((d.airStations ?? []).map((s) => s.measuredAt))
  if (air) out.airQuality = { at: air, label: 'Measured hour' }
  const storm = newest((d.cyclones ?? []).map((c) => c.issuedAt))
  if (storm) out.cyclones = { at: storm, label: 'Latest warning' }
  if (d.newsReadAt) for (const k of ['news', 'councilCentres', 'outages'] as const) out[k] = { at: d.newsReadAt, label: 'Feeds read' }
  if (d.nswReadAt) out.nswFires = { at: d.nswReadAt, label: 'Feed read' }
  return out
}
