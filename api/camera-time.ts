import { z } from 'zod'
import { isCameraImage } from '../src/api/cameraHosts.js'
import { json, query } from './_lib/http.js'

// GET /api/camera-time?url=<image>: when the camera host last changed that
// image, from its Last-Modified header, so the app can date a camera view by
// the publisher's time rather than by when it was fetched. Only known camera
// hosts are asked (see src/api/cameraTime.ts).

export async function GET(request: Request) {
  const q = query(request, z.object({ url: z.string().max(1000) }))
  if (q instanceof Response) return q
  if (!isCameraImage(q.url)) return json({ error: 'Not a camera image address.' }, 400)
  try {
    const res = await fetch(q.url, { method: 'HEAD', signal: AbortSignal.timeout(8_000) })
    const at = Date.parse(res.headers.get('last-modified') ?? '')
    return json({ lastModified: Number.isFinite(at) ? at : null }, 200, 30)
  } catch {
    return json({ lastModified: null }, 200, 30)
  }
}
