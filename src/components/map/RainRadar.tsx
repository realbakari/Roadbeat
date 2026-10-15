import type * as maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { RAIN_RADAR } from '../../api/client'

/** Fetch this much more than the viewport on each side, so short pans need no new image. */
const PAD = 0.3
/** A new image when the zoom changes by this much, so the radar stays sharp. */
const ZOOM_STEP = 0.75
const REFRESH = 300_000

/** Moves and scales the image so its corners sit on the map at the bounds it covers. */
function pin(map: maplibregl.Map, el: HTMLImageElement, [w, s, e, n]: Frame['bounds']) {
  const a = map.project([w, n])
  const b = map.project([e, s])
  el.style.transform = `translate(${a.x}px, ${a.y}px)`
  el.style.width = `${b.x - a.x}px`
  el.style.height = `${b.y - a.y}px`
}

const isFlat = (map: maplibregl.Map) => map.getPitch() === 0 && map.getBearing() === 0

interface Frame {
  src: string
  /** [west, south, east, north] the image covers. */
  bounds: [number, number, number, number]
  zoom: number
}

/**
 * The radar service renders a PNG for the requested bounds but sends no CORS
 * headers, so it can't be a WebGL image source. It's drawn as an <img> pinned to
 * the bounds it covers: every map frame moves and scales it with the map, a new
 * image loads in the background only when the view leaves the covered area or
 * the zoom changes, and it replaces the old one once it has loaded. A tilted or
 * rotated map can't be matched by a flat image, so the radar hides until it's flat.
 */
export function RainRadar({ map, enabled, ready }: { map: maplibregl.Map | null; enabled: boolean; ready: number }) {
  const [frame, setFrame] = useState<Frame | null>(null)
  // Re-render after each move, so a tilt or rotation hides the radar and flattening shows it again.
  const [, setMoves] = useState(0)
  const img = useRef<HTMLImageElement>(null)
  const current = useRef<Frame | null>(null)

  useEffect(() => {
    if (!map || !enabled || !ready) return
    let loading = ''
    let raf = 0

    const place = () => {
      if (current.current && img.current) pin(map, img.current, current.current.bounds)
    }

    const covered = () => {
      const f = current.current
      if (!f || Math.abs(map.getZoom() - f.zoom) >= ZOOM_STEP) return false
      const v = map.getBounds()
      const [w, s, e, n] = f.bounds
      return v.getWest() >= w && v.getEast() <= e && v.getSouth() >= s && v.getNorth() <= n
    }

    const load = (force = false) => {
      if (!isFlat(map)) return
      if (!force && covered()) return
      const v = map.getBounds()
      const dx = (v.getEast() - v.getWest()) * PAD
      const dy = (v.getNorth() - v.getSouth()) * PAD
      const bounds: Frame['bounds'] = [v.getWest() - dx, Math.max(-85, v.getSouth() - dy), v.getEast() + dx, Math.min(85, v.getNorth() + dy)]
      const c = map.getContainer()
      // Device pixels, scaled down evenly so neither side passes 2048 and the service renders quickly.
      const w = c.clientWidth * (1 + 2 * PAD) * Math.min(window.devicePixelRatio || 1, 2)
      const h = c.clientHeight * (1 + 2 * PAD) * Math.min(window.devicePixelRatio || 1, 2)
      const fit = Math.min(1, 2048 / Math.max(w, h))
      const width = Math.round(w * fit)
      const height = Math.round(h * fit)
      const bbox = [bounds[1], bounds[0], bounds[3], bounds[2]].map((x) => x.toFixed(4)).join(',')
      const src = `${RAIN_RADAR}?bounds=${bbox}&width=${width}&height=${height}&t=${Math.floor(Date.now() / REFRESH)}`
      if (src === loading) return
      loading = src
      const next = new Image()
      next.onload = () => {
        if (loading !== src) return
        const f = { src, bounds, zoom: map.getZoom() }
        current.current = f
        setFrame(f)
      }
      next.src = src
    }

    const onMove = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(place)
    }
    const onEnd = () => {
      setMoves((n) => n + 1)
      load()
    }
    load(true)
    map.on('move', onMove)
    map.on('moveend', onEnd)
    const id = setInterval(() => load(true), REFRESH)
    return () => {
      map.off('move', onMove)
      map.off('moveend', onEnd)
      clearInterval(id)
      cancelAnimationFrame(raf)
    }
  }, [map, enabled, ready])

  if (!enabled || !frame || !map || !isFlat(map)) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* The callback ref pins each new frame (and a remounted image) before the browser paints it. */}
      <img
        ref={(el) => {
          img.current = el
          if (el) pin(map, el, frame.bounds)
        }}
        src={frame.src}
        alt=""
        className="absolute top-0 left-0 max-w-none origin-top-left opacity-70"
      />
    </div>
  )
}
