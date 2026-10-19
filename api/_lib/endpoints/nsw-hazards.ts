import { NSW_HAZARD_KINDS, NSW_HAZARDS_SOURCE, parseNswHazards, type NswHazard } from '../../../src/api/nswHazards.js'
import { memoised } from '../memo.js'

// GET /api/nsw-hazards: Transport for NSW's Live Traffic Hazards near the
// Queensland border, for the app's NSW road hazards layer (see
// src/api/nswHazards.ts). The API needs a key, kept in the TFNSW_API_KEY
// setting and sent only from here. Each type is read in turn and only hazards
// north of the border line are sent on. The answer is cached at the edge for a
// minute, so every visitor shares one read, and it sends no CORS header.

const CACHE_S = 60

async function readAll(key: string): Promise<NswHazard[]> {
  const all: NswHazard[] = []
  for (const kind of NSW_HAZARD_KINDS) {
    const res = await fetch(`${NSW_HAZARDS_SOURCE}/${kind}/open`, { headers: { authorization: `apikey ${key}`, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`NSW ${kind} hazards responded with ${res.status}`)
    all.push(...parseNswHazards(kind, await res.json()))
  }
  return all
}

const latest = memoised(CACHE_S * 1000, () => readAll(process.env.TFNSW_API_KEY ?? ''))

const reply = (body: unknown, status: number, cache: string) => Response.json(body, { status, headers: { 'cache-control': cache } })

export async function GET() {
  if (!process.env.TFNSW_API_KEY) return reply({ error: "NSW hazards aren't set up on this server." }, 503, 'no-store')
  try {
    const hazards = await latest()
    return reply({ fetchedAt: Date.now(), hazards }, 200, `public, s-maxage=${CACHE_S}, stale-while-revalidate=${CACHE_S}`)
  } catch (e) {
    console.error('NSW hazards failed:', e)
    return reply({ error: 'Transport for NSW did not respond. Try again shortly.' }, 502, 'no-store')
  }
}
