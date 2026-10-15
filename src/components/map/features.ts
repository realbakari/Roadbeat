import type { GeoJSONSource } from 'maplibre-gl'
import type * as maplibregl from 'maplibre-gl'
import { FIRE_COLOR, fireKindLabel, fireRank, type FireWarning } from '../../api/bushfires'
import type { Gauge } from '../../api/bccGauges'
import type { SignalSite, SignalVolumes } from '../../api/bccSignals'
import type { TrafficEvent } from '../../api/types'
import { latestReading, rainfallSince } from '../../lib/gauges'
import { dsBand, loadChanged, siteLoad } from '../../lib/signals'
import type { Bounds } from '../../lib/geo'
import { fireIcon, signalIcon } from '../../lib/mapIcons'

/** Warning areas and fire markers; markers carry the hash key their detail page opens at. */
export function fireFeatures(fires: FireWarning[]): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = []
  for (const f of fires) {
    const props = {
      key: `fire/${encodeURIComponent(f.id)}`,
      label: `${f.level === 'Information' ? fireKindLabel(f) : f.level} · ${f.area ?? f.title}`,
      color: FIRE_COLOR[f.level],
      icon: fireIcon(f.level),
      rank: fireRank(f),
    }
    if (f.areaShape) out.push({ type: 'Feature', geometry: f.areaShape, properties: props })
    out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: f.position }, properties: props })
  }
  return { type: 'FeatureCollection', features: out }
}

export function setData(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  ;(map.getSource(id) as GeoJSONSource | undefined)?.setData(data)
}

export function boundsOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): Bounds | null {
  const pts = g.type === 'Polygon' ? g.coordinates.flat() : g.coordinates.flat(2)
  if (!pts.length) return null
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ]
}

export function withLabels<T extends GeoJSON.FeatureCollection>(fc: T, events: TrafficEvent[]): T {
  const labels = new Map(
    events.map((e) => [
      e.properties.id,
      [e.properties.event_type, e.properties.road_summary?.road_name].filter(Boolean).join(' · '),
    ]),
  )
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      properties: { ...f.properties, label: labels.get(Number(f.properties?.id)) ?? '' },
    })),
  }
}


/** A gauge's reading this old or older is drawn faded. */
const STALE_MS = 60 * 60_000

/** Stream gauges labelled with their latest height; rain gauges with the last hour's rain. */
export function gaugeFeatures(gauges: Gauge[], now: number): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = []
  for (const g of gauges) {
    const latest = latestReading(g)
    const rain = g.kind === 'rain' ? rainfallSince(g, now - 60 * 60_000).mm : 0
    const value = g.kind === 'stream' ? (latest ? `${latest.value.toFixed(2)} m` : '') : rain > 0 ? `${rain} mm` : ''
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: g.position },
      properties: {
        key: `gauge/${encodeURIComponent(g.id)}`,
        kind: g.kind,
        value,
        stale: !latest || now - latest.time >= STALE_MS,
        label: `${g.kind === 'stream' ? 'Stream gauge' : 'Rain gauge'} · ${g.name}${value ? ` · ${value}` : ''}`,
      },
    })
  }
  return { type: 'FeatureCollection', features: out }
}

/**
 * Signal sites with live data, coloured by their busiest lane's measured degree
 * of saturation. With the previous batch, sites whose saturation changed
 * noticeably are flagged `changed`, for the update ring.
 */
export function signalFeatures(sites: SignalSite[], volumes: SignalVolumes, previous: SignalVolumes | null = null): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = []
  for (const s of sites) {
    const approaches = volumes.get(s.tsc)
    if (!approaches) continue
    const load = siteLoad(approaches)
    const before = previous?.get(s.tsc)
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: s.position },
      properties: {
        key: `signal/${encodeURIComponent(s.tsc)}`,
        icon: signalIcon(dsBand(load.maxDs)),
        ds: load.maxDs,
        saturated: load.maxDs >= 100,
        changed: !!before && loadChanged(siteLoad(before).maxDs, load.maxDs),
        value: `${Math.round(load.maxDs)}%`,
        label: `${s.streets.slice(0, 2).join(' & ') || `Signal ${s.tsc}`} · busiest lane ${Math.round(load.maxDs)}% saturated`,
      },
    })
  }
  return { type: 'FeatureCollection', features: out }
}
