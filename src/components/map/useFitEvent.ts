import type * as maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { TrafficEvent } from '../../api/types'
import { eventBounds } from '../../lib/geo'

/**
 * Fits the map to an event once when it is opened. Every refresh brings a new
 * copy of the open event, so this keys on its id: a pan or zoom the user makes
 * afterwards stays put.
 */
export function useFitEvent(map: maplibregl.Map | null, event: TrafficEvent | null) {
  const fitted = useRef<number | null>(null)
  useEffect(() => {
    if (!map || !event) {
      fitted.current = null
      return
    }
    if (fitted.current === event.properties.id) return
    fitted.current = event.properties.id
    const b = eventBounds(event)
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 14, duration: 800 })
  }, [map, event])
}
