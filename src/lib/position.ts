import type { LngLat } from './distance'

/**
 * The browser's position, once. Rejects with a sentence to show: no location
 * support, permission denied, or no fix in time. A fix up to `maxAgeMs` old
 * is fine, so asking twice in a row doesn't wait for the GPS again.
 */
export function currentPosition(maxAgeMs = 600_000): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser does not support location.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Location permission was denied.' : 'Your location could not be found.')),
      { timeout: 10_000, maximumAge: maxAgeMs },
    )
  })
}
