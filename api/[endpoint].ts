import * as bushfires from './_lib/endpoints/bushfires.js'
import * as cameraTime from './_lib/endpoints/camera-time.js'
import * as departures from './_lib/endpoints/departures.js'
import * as events from './_lib/endpoints/events.js'
import * as feedback from './_lib/endpoints/feedback.js'
import * as fuel from './_lib/endpoints/fuel.js'
import * as history from './_lib/endpoints/history.js'
import * as nswHazards from './_lib/endpoints/nsw-hazards.js'
import * as roads from './_lib/endpoints/roads.js'
import * as share from './_lib/endpoints/share.js'
import * as shareImage from './_lib/endpoints/share-image.js'
import * as stops from './_lib/endpoints/stops.js'
import * as visits from './_lib/endpoints/visits.js'
import { json } from './_lib/http.js'

// One Vercel function for the small endpoints: /api/events, /api/stops,
// /api/departures, /api/bushfires, /api/history, /api/camera-time,
// /api/fuel, /api/nsw-hazards, /api/share (an HTML page for link previews) and
// /api/share-image (a timeline post's preview card), /api/roads (the text-only
// events page, served at /roads), /api/visits and /api/feedback
// (the two that take POST). Vercel's Hobby plan deploys at
// most 12 functions, and each file in api/ (plus middleware.ts) is one, so
// these share a file. The handlers live in api/_lib/endpoints/, which Vercel
// doesn't deploy on its own.

type Handler = (request: Request) => Response | Promise<Response>
interface Endpoint {
  GET: Handler
  POST?: Handler
  OPTIONS?: Handler
}

const ENDPOINTS: Record<string, Endpoint> = {
  bushfires,
  'camera-time': cameraTime,
  departures,
  events,
  feedback,
  fuel,
  history,
  'nsw-hazards': nswHazards,
  roads,
  share,
  'share-image': shareImage,
  stops,
  visits,
}

/**
 * The endpoint named by the last path segment: "/api/events?q=…" → events. A
 * rewrite from a page address (vercel.json) keeps that address in the request,
 * so it names the endpoint in its query instead: "/timeline/road/1?endpoint=share".
 */
function endpointFor(request: Request): Endpoint | null {
  const url = new URL(request.url)
  const last = url.pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  const name = url.pathname.startsWith('/api/') ? last : (url.searchParams.get('endpoint') ?? last)
  return Object.hasOwn(ENDPOINTS, name) ? ENDPOINTS[name] : null
}

/** A 405 whose Allow header lists the methods this endpoint does take. */
function notAllowed(endpoint: Endpoint): Response {
  const methods = (['GET', 'POST', 'OPTIONS'] as const).filter((m) => endpoint[m])
  return new Response(null, { status: 405, headers: { allow: methods.join(', ') } })
}

export function GET(request: Request) {
  const endpoint = endpointFor(request)
  return endpoint ? endpoint.GET(request) : json({ error: 'No such endpoint. See /openapi.json.' }, 404)
}

export function POST(request: Request) {
  const endpoint = endpointFor(request)
  if (!endpoint) return json({ error: 'No such endpoint. See /openapi.json.' }, 404)
  return endpoint.POST ? endpoint.POST(request) : notAllowed(endpoint)
}

export function OPTIONS(request: Request) {
  const endpoint = endpointFor(request)
  if (!endpoint) return json({ error: 'No such endpoint. See /openapi.json.' }, 404)
  return endpoint.OPTIONS ? endpoint.OPTIONS(request) : notAllowed(endpoint)
}
