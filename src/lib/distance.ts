// A longitude/latitude pair and the distance between two of them. Tiny and
// pure, so the map code and the server functions in api/ share one formula.

/** [longitude, latitude], the order GeoJSON and MapLibre use. */
export type LngLat = [number, number]

/** Great-circle distance in km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
