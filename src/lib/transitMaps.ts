import MAPS from '../data/translink-maps.json'

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(pdf\)|locality map|park 'n' ride|station|shopping centre|bus|ferry terminal|\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

let index: Map<string, { label: string; href: string }> | null = null

/** Stations whose Translink stop name differs from their locality map's title. */
const BY_STOP: Record<string, string> = {
  place_asphyp: 'Aspley',
  place_intcar: 'Carindale',
  place_intgcy: 'Garden City',
  place_pahste: 'Princess Alexandra Hospital',
  place_rbwhp: "Royal Brisbane and Women's Hospital (RBWH)",
  place_upmgbs: 'Upper Mount Gravatt',
  place_sprbst: 'Springwood locality',
}

/**
 * Translink's station/locality map for a stop or station name ("Central
 * station" → the Central locality map), or null when it doesn't publish one.
 * Only exact name matches (or the listed stop ids) count, so a stop never gets
 * another place's map.
 */
export function findStationMap(name: string, stopId?: string) {
  if (!index) {
    index = new Map()
    for (const r of MAPS.regions)
      for (const g of r.groups)
        if (g.title === 'Station and locality maps') for (const m of g.maps) index.set(norm(m.label), m)
  }
  const alias = stopId ? BY_STOP[stopId] : undefined
  return index.get(norm(alias ?? name)) ?? null
}
