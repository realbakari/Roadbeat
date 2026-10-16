import { isCameraImage } from './cameraHosts'

// When a camera image was published, from the camera host's own Last-Modified
// header. Camera hosts send no CORS headers, so the browser can't read the
// header itself; api/camera-time.ts (and the dev server) read it on its behalf.

export { isCameraImage }

export const CAMERA_TIME_URL: string = import.meta.env.VITE_CAMERA_TIME_URL ?? '/api/camera-time'

/** When the camera host says it last changed the image, as epoch ms, or null when it doesn't say. */
export async function fetchCameraTime(image: string, signal?: AbortSignal): Promise<number | null> {
  const res = await fetch(`${CAMERA_TIME_URL}?url=${encodeURIComponent(image)}`, { signal })
  if (!res.ok) return null
  const body = (await res.json()) as { lastModified: number | null }
  return body.lastModified
}
