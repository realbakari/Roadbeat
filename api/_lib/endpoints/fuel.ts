import { FUEL_FIELDS, parseFuelStations, type FuelStation } from '../../../src/api/fuelAvailability.js'
import { memoised } from '../memo.js'

// GET /api/fuel: fuel availability at Queensland service stations, for the
// app's fuel layer (see src/api/fuelAvailability.ts). The layer's address is
// the FUEL_LAYER_URL setting, kept out of the code, and the server asks it for
// availability fields only. The answer is cached at the edge for 5 minutes,
// so every visitor shares one read. It sends no CORS header, so other sites
// can't use it from their pages.

const CACHE_S = 300

async function readLayer(base: string): Promise<FuelStation[]> {
  const all: FuelStation[] = []
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ where: '1=1', outFields: FUEL_FIELDS.join(','), outSR: '4326', geometryPrecision: '5', resultOffset: String(all.length), f: 'geojson' })
    const res = await fetch(`${base.replace(/\/query\/?$/, '')}/query?${q}`, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`fuel layer responded with ${res.status}`)
    const { stations, more } = parseFuelStations(await res.json())
    all.push(...stations)
    if (!more || !stations.length) break
  }
  if (!all.length) throw new Error('fuel layer listed no stations')
  return all
}

const latest = memoised(CACHE_S * 1000, () => readLayer(process.env.FUEL_LAYER_URL ?? ''))

const reply = (body: unknown, status: number, cache: string) => Response.json(body, { status, headers: { 'cache-control': cache } })

export async function GET() {
  if (!process.env.FUEL_LAYER_URL) return reply({ error: "Fuel status isn't set up on this server." }, 503, 'no-store')
  try {
    const stations = await latest()
    return reply({ fetchedAt: Date.now(), stations }, 200, `public, s-maxage=${CACHE_S}, stale-while-revalidate=${CACHE_S}`)
  } catch (e) {
    console.error('Fuel layer failed:', e)
    return reply({ error: 'Fuel status did not respond. Try again shortly.' }, 502, 'no-store')
  }
}
