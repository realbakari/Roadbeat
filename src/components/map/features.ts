import type { GeoJSONSource } from 'maplibre-gl'
import type * as maplibregl from 'maplibre-gl'
import { FIRE_COLOR, fireKindLabel, fireRank, type FireWarning } from '../../api/bushfires'
import type { Gauge } from '../../api/bccGauges'
import type { SignalSite, SignalVolumes } from '../../api/bccSignals'
import { clearanceLabel, type Clearance } from '../../api/clearances'
import type { AccessibleBay, BikeStop, Clearway, ParkingMeter, Toilet } from '../../api/bccPlaces'
import type { CouncilEvent } from '../../api/bccDashboard'
import { clearwayInEffect, parseClearwayTimes } from '../../lib/clearways'
import type { TrafficEvent } from '../../api/types'
import { latestReading, rainfallSince } from '../../lib/gauges'
import { dsBand, loadChanged, siteLoad } from '../../lib/signals'
import type { Bounds } from '../../lib/geo'
import { clearanceIcon, fireIcon, signalIcon } from '../../lib/mapIcons'

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

/** Low clearance signs; each carries the hash key its detail page opens at. */
export function clearanceFeatures(list: Clearance[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c.position },
      properties: {
        key: `place/clearance/${encodeURIComponent(c.id)}`,
        label: `${clearanceLabel(c.metres)} clearance · ${c.title}`,
        icon: clearanceIcon(c.metres),
        metres: c.metres,
      },
    })),
  }
}

/** Clearways, each marked "on" while its signed times cover `now`, "off" when they don't, or "unknown". */
export function clearwayFeatures(list: Clearway[], now: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.map((c) => {
      const on = clearwayInEffect(parseClearwayTimes(c.times), now)
      return {
        type: 'Feature',
        geometry: c.geometry,
        properties: {
          key: `place/clearway/${encodeURIComponent(c.id)}`,
          state: on == null ? 'unknown' : on ? 'on' : 'off',
          label: `Clearway${c.times ? ` · ${c.times}` : ''}${on ? ' · in effect now' : ''}`,
        },
      }
    }),
  }
}

/** Public toilets, accessible parking, parking meters and bike racks, sharing one source. */
export function councilPlaceFeatures({
  toilets,
  bays,
  meters,
  bikeStops,
}: {
  toilets: Toilet[]
  bays: AccessibleBay[]
  meters: ParkingMeter[]
  bikeStops: BikeStop[]
}): GeoJSON.FeatureCollection {
  const point = (position: [number, number]) => ({ type: 'Point' as const, coordinates: position })
  return {
    type: 'FeatureCollection',
    features: [
      ...meters.map((m) => ({
        type: 'Feature' as const,
        geometry: point(m.position),
        properties: { key: `place/meter/${encodeURIComponent(m.id)}`, icon: 'parking-meter', label: `Parking meter${m.street ? ` · ${m.street}` : ''}` },
      })),
      ...bikeStops.map((b) => ({
        type: 'Feature' as const,
        geometry: point(b.position),
        properties: { key: `place/bike/${encodeURIComponent(b.id)}`, icon: b.kind === 'repair' ? 'bike-repair' : 'bike-rack', label: `${b.kind === 'repair' ? 'Bike repair station' : 'Bike rack'} · ${b.name}` },
      })),
      ...toilets.map((t) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: t.position },
        properties: { key: `place/toilet/${encodeURIComponent(t.id)}`, icon: t.accessible ? 'toilet-accessible' : 'toilet', label: `Toilet · ${t.name}` },
      })),
      ...bays.map((b) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: b.position },
        properties: {
          key: `place/bay/${encodeURIComponent(b.id)}`,
          icon: 'accessible-parking',
          label: `Accessible parking${b.street ? ` · ${b.street}` : ''}`,
        },
      })),
    ],
  }
}

/** Council events that have a position; each carries the hash key its detail page opens at. */
export function councilEventFeatures(list: CouncilEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.flatMap((e) =>
      e.position
        ? [
            {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: e.position },
              properties: { key: `place/event/${encodeURIComponent(e.id)}`, icon: 'council-event', label: [e.title, e.when].filter(Boolean).join(' · ') },
            },
          ]
        : [],
    ),
  }
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
