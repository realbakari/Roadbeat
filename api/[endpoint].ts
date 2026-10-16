import * as bushfires from './_lib/endpoints/bushfires.js'
import * as cameraTime from './_lib/endpoints/camera-time.js'
import * as departures from './_lib/endpoints/departures.js'
import * as events from './_lib/endpoints/events.js'
import * as history from './_lib/endpoints/history.js'
import * as stops from './_lib/endpoints/stops.js'
import { json } from './_lib/http.js'

// One Vercel function for the small read-only endpoints: /api/events,
// /api/stops, /api/departures, /api/bushfires, /api/history and
// /api/camera-time. Vercel's Hobby plan deploys at most 12 functions, and each
// file in api/ (plus middleware.ts) is one, so these share a file. The
// handlers live in api/_lib/endpoints/, which Vercel doesn't deploy on its own.

type Handler = (request: Request) => Response | Promise<Response>
interface Endpoint {
  GET: Handler
  OPTIONS?: Handler
}

const ENDPOINTS: Record<string, Endpoint> = {
  bushfires,
  'camera-time': cameraTime,
  departures,
  events,
  history,
  stops,
}

/** The endpoint named by the last path segment: "/api/events?q=…" → events. */
function endpointFor(request: Request): Endpoint | null {
  const name = new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  return Object.hasOwn(ENDPOINTS, name) ? ENDPOINTS[name] : null
}

export function GET(request: Request) {
  const endpoint = endpointFor(request)
  return endpoint ? endpoint.GET(request) : json({ error: 'No such endpoint. See /openapi.json.' }, 404)
}

export function OPTIONS(request: Request) {
  const endpoint = endpointFor(request)
  if (!endpoint) return json({ error: 'No such endpoint. See /openapi.json.' }, 404)
  return endpoint.OPTIONS ? endpoint.OPTIONS(request) : new Response(null, { status: 405, headers: { allow: 'GET' } })
}
