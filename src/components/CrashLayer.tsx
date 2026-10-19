import { Loader, Text } from '@cloudflare/kumo'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { CRASH_POINT_ZOOM } from './map/crashLayers'
import {
  CRASH_DATA_END,
  CRASH_POINT_CAP,
  fetchCrashGrid,
  fetchCrashPoints,
  SEVERITIES,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  type CrashFilter,
} from '../api/crashes'

const CELL_PX = 10

interface Status {
  loading: boolean
  mode: 'heat' | 'points'
  count: number | null
  capped: boolean
  error: string | null
}

/**
 * Historical crashes for the area in view, refetched (debounced) after each
 * pan/zoom. The heatmap bins crashes into a grid server-side so the whole
 * state stays cheap; zoomed in, individual crashes are coloured by severity.
 */
export function CrashLayer({
  map,
  ready,
  enabled,
  filter,
}: {
  map: MapLibreMap
  ready: number
  enabled: boolean
  filter: CrashFilter
}) {
  const [status, setStatus] = useState<Status>({ loading: false, mode: 'heat', count: null, capped: false, error: null })

  useEffect(() => {
    if (!enabled || !ready) return
    let ctrl: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      ctrl?.abort()
      const c = new AbortController()
      ctrl = c
      const zoom = map.getZoom()
      const b = map.getBounds()
      const padX = (b.getEast() - b.getWest()) * 0.1
      const padY = (b.getNorth() - b.getSouth()) * 0.1
      const bbox: [number, number, number, number] = [
        Math.max(137.9, b.getWest() - padX),
        Math.max(-29.2, b.getSouth() - padY),
        Math.min(153.7, b.getEast() + padX),
        Math.min(-9, b.getNorth() + padY),
      ]
      const mode = zoom >= CRASH_POINT_ZOOM ? 'points' : 'heat'
      setStatus((s) => ({ ...s, loading: true, mode, error: null }))
      try {
        if (mode === 'points') {
          const r = await fetchCrashPoints(bbox, filter, c.signal)
          setSource(map, 'crash-points', r.points)
          setStatus({ loading: false, mode, count: r.points.features.length, capped: r.capped, error: null })
        } else {
          const cell = (CELL_PX * 360) / (512 * 2 ** Math.floor(zoom))
          const r = await fetchCrashGrid(bbox, Number(cell.toPrecision(2)), filter, c.signal)
          setSource(map, 'crash-grid', r.cells)
          setSource(map, 'crash-points', EMPTY)
          setStatus({ loading: false, mode, count: r.total, capped: false, error: null })
        }
      } catch (e) {
        if (c.signal.aborted) return
        setStatus((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Crash data failed to load.' }))
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 300)
    }

    load()
    map.on('moveend', schedule)
    return () => {
      map.off('moveend', schedule)
      clearTimeout(timer)
      ctrl?.abort()
    }
  }, [map, ready, enabled, filter])

  // Leave no stale crashes behind when the layer is switched off.
  useEffect(() => {
    if (enabled || !ready) return
    setSource(map, 'crash-grid', EMPTY)
    setSource(map, 'crash-points', EMPTY)
    setStatus((s) => ({ ...s, count: null }))
  }, [map, ready, enabled])

  if (!enabled) return null
  const years = filter.from === filter.to ? `${filter.from}` : `${filter.from}–${filter.to}`
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-8 flex justify-center">
      <div className="pointer-events-auto grid max-w-80 gap-1 rounded-lg bg-kumo-base/95 px-3 py-2 shadow-md ring ring-kumo-line">
        <div className="flex items-center gap-2">
          <Text size="sm" bold>
            Crash history {years}
          </Text>
          {status.loading && <Loader size="sm" />}
        </div>
        <Text size="xs" variant="secondary">
          {status.error ??
            (status.count == null
              ? 'Loading…'
              : status.mode === 'heat'
                ? `${status.count.toLocaleString()} crashes in this area · zoom in for individual crashes`
                : status.capped
                  ? `Showing the ${CRASH_POINT_CAP.toLocaleString()} most severe crashes in this area`
                  : `${status.count.toLocaleString()} crashes in this area`)}
        </Text>
        {status.mode === 'points' && (
          <ul className="flex flex-wrap gap-x-2.5 gap-y-0.5">
            {SEVERITIES.filter((s) => filter.severities.includes(s)).map((s) => (
              <li key={s} className="flex items-center gap-1 text-xs text-kumo-subtle">
                <span className="size-2.5 rounded-full ring ring-white/70" style={{ background: SEVERITY_COLOR[s] }} />
                {SEVERITY_LABEL[s]}
              </li>
            ))}
          </ul>
        )}
        <Text size="xs" variant="secondary">
          Police-reported crashes to {CRASH_DATA_END}; last 12 months preliminary. Transport and Main Roads, CC BY 4.0.
        </Text>
      </div>
    </div>
  )
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function setSource(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection) {
  ;(map.getSource(id) as GeoJSONSource | undefined)?.setData(data)
}
