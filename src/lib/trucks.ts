import type { TruckRestriction } from '../api/types'
import type { LngLat } from './distance'

// QLDTraffic's truck restrictions (restrictedtruck.geojson). The feed gives
// every restriction properties.id 1 and no feature id, so its own id can't
// tell them apart.

/** A key per restriction that stays the same across reads: its published id and name, as "1-pacific-motorway-truck-lane-restrictions". */
export function truckKey(t: TruckRestriction): string {
  const slug = (t.properties.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug ? `${t.properties.id}-${slug}` : String(t.properties.id)
}

/** The restriction a #place/truck/<key> link names. A link from before keys carried the name opens a restriction only if its id is unique. */
export function findTruck(trucks: TruckRestriction[], key: string): TruckRestriction | null {
  const keyed = trucks.find((t) => truckKey(t) === key)
  if (keyed) return keyed
  const byId = trucks.filter((t) => String(t.properties.id) === key)
  return byId.length === 1 ? byId[0] : null
}

/** Where the restriction's tappable icon sits: the middle vertex of its longest line. */
export function truckIconPoint(t: TruckRestriction): LngLat | null {
  const lines = t.geometry?.coordinates ?? []
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), lines[0] ?? [])
  const p = longest[Math.floor(longest.length / 2)]
  return p ? [p[0], p[1]] : null
}

/** "Mansfield to Rocklea", or null when the feed gives no ends (the Pacific Motorway restriction gives none). */
export function truckSubtitle(t: TruckRestriction): string | null {
  const { originterm: from, destinationterm: to } = t.properties
  return from && to ? `${from} to ${to}` : from || to || null
}
