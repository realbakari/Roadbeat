import type * as maplibregl from 'maplibre-gl'
import { useEffect } from 'react'

/** One halo breath for saturated signals, in ms. */
const HALO_PERIOD = 2_400
/** How long the update ring takes to expand and fade, in ms. */
const RING_MS = 1_600
/** Redraws per second; plenty for a slow pulse and cheap on the map. */
const FPS = 30

/** True when the viewer asked their system for less motion. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animates the signal layers from real data only: saturated sites (100 % and
 * over) breathe a halo, and sites whose saturation changed in the newest batch
 * give one expanding ring when `batch` changes. Nothing here shows light timing,
 * which the council's feed doesn't publish.
 */
export function useSignalAnimation(map: maplibregl.Map | null, ready: number, enabled: boolean, batch: number) {
  useEffect(() => {
    if (!map || !ready || !enabled) return
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 1000 / FPS || !map.getLayer('signals-halo')) return
      last = now
      const phase = (Math.sin((now / HALO_PERIOD) * Math.PI * 2) + 1) / 2
      map.setPaintProperty('signals-halo', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 10, 6 + 6 * phase, 16, 12 + 12 * phase])
      map.setPaintProperty('signals-halo', 'circle-opacity', 0.15 + 0.25 * (1 - phase))
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      if (map.getLayer('signals-halo')) map.setPaintProperty('signals-halo', 'circle-opacity', 0)
    }
  }, [map, ready, enabled])

  useEffect(() => {
    if (!map || !ready || !enabled || !batch) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (!map.getLayer('signals-ring')) return
      const t = Math.min(1, (now - start) / RING_MS)
      map.setPaintProperty('signals-ring', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 10, 4 + 14 * t, 16, 8 + 26 * t])
      map.setPaintProperty('signals-ring', 'circle-stroke-opacity', 0.8 * (1 - t))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      if (map.getLayer('signals-ring')) map.setPaintProperty('signals-ring', 'circle-stroke-opacity', 0)
    }
  }, [map, ready, enabled, batch])
}
