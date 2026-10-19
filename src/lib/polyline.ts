import type { LngLat } from './distance.js'

/**
 * Decodes a line in Google's encoded polyline format (precision 5), which
 * Transport for NSW publishes for each hazard's extent, into [lng, lat] points.
 * A string that ends mid-number gives the points read before it.
 */
export function decodePolyline(encoded: string): LngLat[] {
  const points: LngLat[] = []
  let i = 0
  let lat = 0
  let lng = 0
  const next = (): number | null => {
    let result = 0
    let shift = 0
    for (;;) {
      if (i >= encoded.length) return null
      const b = encoded.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
      if (b < 0x20) break
    }
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (i < encoded.length) {
    const dLat = next()
    const dLng = next()
    if (dLat == null || dLng == null) break
    lat += dLat
    lng += dLng
    points.push([lng / 1e5, lat / 1e5])
  }
  return points
}
