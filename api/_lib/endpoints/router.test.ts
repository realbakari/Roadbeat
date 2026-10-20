import { describe, expect, it } from 'vitest'
import { GET, OPTIONS, POST } from '../../[endpoint].js'

const req = (path: string, method = 'GET') => new Request(`https://roadbeat.test${path}`, { method })

describe('api/[endpoint].ts router', () => {
  it('serves a known endpoint at its old path', async () => {
    const res = await GET(req('/api/stops?q=Central'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { stops: { name: string }[] }
    expect(body.stops.length).toBeGreaterThan(0)
  })

  it('passes query validation errors through from the endpoint', async () => {
    const res = await GET(req('/api/stops'))
    expect(res.status).toBe(400)
  })

  it('validates the share page query before reading any feed', async () => {
    expect((await GET(req('/api/share'))).status).toBe(400)
    expect((await GET(req('/api/share?event=abc'))).status).toBe(400)
  })

  it('serves a page address a rewrite sends here, by the endpoint its query names', async () => {
    // vercel.json sends link-preview crawlers from /timeline/<source>/<id>; the request keeps that address.
    expect((await GET(req('/timeline/likes/1?endpoint=share&source=likes&id=1'))).status).toBe(400)
    expect((await GET(req('/timeline/road/1'))).status).toBe(404)
  })

  it("lets only the path name an /api/ address's endpoint", async () => {
    expect((await GET(req('/api/stops?q=Central&endpoint=share'))).status).toBe(200)
  })

  it('answers 404 for an unknown endpoint', async () => {
    const res = await GET(req('/api/nope'))
    expect(res.status).toBe(404)
  })

  it('does not treat object prototype names as endpoints', async () => {
    expect((await GET(req('/api/toString'))).status).toBe(404)
    expect((await GET(req('/api/constructor'))).status).toBe(404)
  })

  it('serves the visitor count, saying so when there is no store', async () => {
    const res = await GET(req('/api/visits'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ available: false })
    expect((await POST(req('/api/visits', 'POST'))).status).toBe(204)
  })

  it('takes feedback only where a store is connected, and never lists it without the owner secret', async () => {
    const res = await GET(req('/api/feedback'))
    expect(await res.json()).toEqual({ enabled: false })
    expect((await POST(req('/api/feedback', 'POST'))).status).toBe(503)
  })

  it('answers 405 to POST on read-only endpoints and 404 on unknown ones', async () => {
    expect((await POST(req('/api/events', 'POST'))).status).toBe(405)
    expect((await POST(req('/api/nope', 'POST'))).status).toBe(404)
  })

  it('keeps CORS preflight only on the endpoints that had it', async () => {
    expect((await OPTIONS(req('/api/events', 'OPTIONS'))).status).toBe(204)
    expect((await OPTIONS(req('/api/history', 'OPTIONS'))).status).toBe(405)
  })
})
