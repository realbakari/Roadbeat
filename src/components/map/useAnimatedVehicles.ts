import type * as maplibregl from 'maplibre-gl'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { LiveVehicle } from '../../api/translink'
import { vehicleMarkers, type LngLat } from '../../lib/geo'
import { setData } from './features'

/** Vehicles that jumped further than this between updates (new trip, GPS glitch) snap instead of gliding. */
const MAX_GLIDE_KM = 3
/**
 * When a new position report arrives, slide the vehicle there over one second
 * so the movement is visible. Between reports vehicles sit exactly at their
 * last reported GPS position: nothing is extrapolated or estimated.
 */
const GLIDE_MS = 1_000

/**
 * Feeds live vehicle positions into the map, sliding each vehicle from its
 * previous report to its newly reported position. Only vehicles in (or near) the view
 * are redrawn, and the redraw rate adapts to how many there are.
 */
export function useAnimatedVehicles(map: maplibregl.Map | null, ready: number, vehicles: LiveVehicle[], followId: string | null) {
  const drawn = useRef(new Map<string, LngLat>())
  const followRef = useRef(followId)
  useLayoutEffect(() => {
    followRef.current = followId
  }, [followId])

  useEffect(() => {
    if (!map || !ready) return
    const base = vehicleMarkers(vehicles).features
    const from = new Map<string, LngLat>()
    const to = new Map<string, LngLat>()
    for (const v of vehicles) {
      const prev = drawn.current.get(v.id)
      const far = prev && Math.hypot(prev[0] - v.position[0], prev[1] - v.position[1]) * 111 > MAX_GLIDE_KM
      from.set(v.id, prev && !far ? prev : v.position)
      to.set(v.id, v.position)
    }
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let raf = 0
    let last = 0
    let done = false

    const draw = (k: number) => {
      const b = map.getBounds()
      const padX = (b.getEast() - b.getWest()) * 0.2
      const padY = (b.getNorth() - b.getSouth()) * 0.2
      const show = map.getZoom() >= 8
      const features = []
      const next = new Map<string, LngLat>()
      for (const f of base) {
        const id = String(f.properties.key).slice('vehicle/'.length)
        const a = from.get(id)!
        const z = to.get(id)!
        const p: LngLat = [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k]
        next.set(id, p)
        if (id === followRef.current) map.jumpTo({ center: p })
        if (
          show &&
          p[0] > b.getWest() - padX &&
          p[0] < b.getEast() + padX &&
          p[1] > b.getSouth() - padY &&
          p[1] < b.getNorth() + padY
        ) {
          features.push({ ...f, geometry: { type: 'Point' as const, coordinates: p } })
        }
      }
      drawn.current = next
      setData(map, 'vehicles', { type: 'FeatureCollection', features })
      return features.length
    }

    let count = draw(reduceMotion ? 1 : 0)
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / GLIDE_MS)
      // Fewer vehicles in view → smoother redraws; thousands → ~8 fps.
      const interval = count > 600 ? 125 : count > 200 ? 66 : 33
      if (t - last >= interval || k === 1) {
        last = t
        count = draw(k)
      }
      if (k < 1) raf = requestAnimationFrame(frame)
      else done = true
    }
    if (!reduceMotion) raf = requestAnimationFrame(frame)
    else done = true

    // After the glide ends, panning still needs vehicles that were off-screen.
    const onMoveEnd = () => {
      if (done) draw(1)
    }
    map.on('moveend', onMoveEnd)
    return () => {
      cancelAnimationFrame(raf)
      map.off('moveend', onMoveEnd)
    }
  }, [map, ready, vehicles])
}

