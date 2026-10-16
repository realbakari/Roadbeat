import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { MapLayers } from '../components/map/settings'
import type { LngLat } from '../lib/geo'
import { findPlace, PLACE_LAYER, placeFocus, type Place, type PlaceSources } from '../lib/places'
import { parseHash, type Selection } from '../lib/route'

export type MapFocus = { center: LngLat; zoom?: number; ring?: boolean }

/** The selection in the URL hash, and `go` to change it ('' clears it). */
export function useHashSelection() {
  const [sel, setSel] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => setSel(parseHash(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((hash: string) => {
    if (hash) location.hash = hash
    else history.pushState(null, '', location.pathname + location.search)
    setSel(parseHash(location.hash))
  }, [])
  return [sel, go] as const
}

/**
 * The place a #place link selects. Opening one turns its map layer on and
 * flies the map to it; closing it clears the map focus unless a vehicle is open.
 */
export function useSelectedPlace(
  sel: Selection,
  sources: PlaceSources,
  setLayers: Dispatch<SetStateAction<MapLayers>>,
  setFocus: Dispatch<SetStateAction<MapFocus | null>>,
): Place | null {
  const { restAreas, dumpPoints, truckRestrictions, waze, clearances, clearways, toilets, bays, meters, bikeStops, councilEvents, councilCentres, outages, airStations, hotspots } = sources
  const place = useMemo(
    () =>
      sel.place
        ? findPlace(sel.place, { restAreas, dumpPoints, truckRestrictions, waze, clearances, clearways, toilets, bays, meters, bikeStops, councilEvents, councilCentres, outages, airStations, hotspots })
        : null,
    [sel.place, restAreas, dumpPoints, truckRestrictions, waze, clearances, clearways, toilets, bays, meters, bikeStops, councilEvents, councilCentres, outages, airStations, hotspots],
  )

  const kind = sel.place?.kind
  useEffect(() => {
    const key = kind ? PLACE_LAYER[kind] : undefined
    if (key) setLayers((l) => (l[key] ? l : { ...l, [key]: true }))
  }, [kind, setLayers])

  const vehicleOpen = !!sel.vehicle
  useEffect(() => {
    if (!place) {
      if (!vehicleOpen) setFocus(null)
      return
    }
    const focus = placeFocus(place)
    if (focus) setFocus(focus)
  }, [place, vehicleOpen, setFocus])

  return place
}
