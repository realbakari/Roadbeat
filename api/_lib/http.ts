import { z } from 'zod'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

/** A JSON response anyone may read, cached at the edge for `maxAge` seconds. */
export function json(body: unknown, status = 200, maxAge = 30): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS, 'cache-control': status === 200 ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` : 'no-store' },
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

/** Parses a request's query string with a zod schema, or returns a 400 response that says what's wrong. */
export function query<T extends z.ZodType>(request: Request, schema: T): z.infer<T> | Response {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = schema.safeParse(params)
  return parsed.success ? parsed.data : json({ error: 'Invalid query', issues: z.flattenError(parsed.error).fieldErrors }, 400)
}

/**
 * Runs a handler and turns a failed upstream fetch into a 502. The error itself
 * goes to the function log, not the caller: it can name internal addresses.
 */
export async function upstream(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (e) {
    console.error('Upstream failed:', e)
    return json({ error: 'An official data source did not respond. Try again shortly.' }, 502)
  }
}

export const Region = z.enum(['SEQ', 'CNS'])
export const Limit = z.coerce.number().int().min(1).max(50)
export const Bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1')
