import type * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { RAIN_RADAR } from '../../api/client'

/**
 * The radar service renders a PNG for the requested bounds but sends no CORS
 * headers, so it can't be a WebGL image source. It's drawn as a plain <img>
 * over the map instead, refetched after each pan/zoom and every 5 minutes.
 */
export function RainRadar({ map, enabled, ready }: { map: maplibregl.Map | null; enabled: boolean; ready: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    if (!map || !enabled || !ready) return
    const update = () => {
      const b = map.getBounds()
      const c = map.getContainer()
      const bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((n) => n.toFixed(4)).join(',')
      setSrc(
        `${RAIN_RADAR}?bounds=${bbox}&width=${Math.round(c.clientWidth / 2)}&height=${Math.round(c.clientHeight / 2)}&t=${Math.floor(Date.now() / 300_000)}`,
      )
      setMoving(false)
    }
    const start = () => setMoving(true)
    update()
    map.on('movestart', start)
    map.on('moveend', update)
    const id = setInterval(update, 300_000)
    return () => {
      map.off('movestart', start)
      map.off('moveend', update)
      clearInterval(id)
    }
  }, [map, enabled, ready])

  if (!enabled || !src) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-70 ${moving ? 'invisible' : ''}`}
    />
  )
}

