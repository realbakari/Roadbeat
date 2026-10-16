import { describe, expect, it } from 'vitest'
import { GET, OPTIONS } from '../../[endpoint].js'

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

  it('answers 404 for an unknown endpoint', async () => {
    const res = await GET(req('/api/nope'))
    expect(res.status).toBe(404)
  })

  it('does not treat object prototype names as endpoints', async () => {
    expect((await GET(req('/api/toString'))).status).toBe(404)
    expect((await GET(req('/api/constructor'))).status).toBe(404)
  })

  it('keeps CORS preflight only on the endpoints that had it', async () => {
    expect((await OPTIONS(req('/api/events', 'OPTIONS'))).status).toBe(204)
    expect((await OPTIONS(req('/api/history', 'OPTIONS'))).status).toBe(405)
  })
})
