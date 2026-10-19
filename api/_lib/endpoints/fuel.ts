import { FPQ_API, parseFuelData, type FuelStation } from '../../../src/api/fuelStations.js'
import { memoised } from '../memo.js'

// GET /api/fuel: Queensland service stations with their fuel prices and
// availability, from the state's Fuel Prices Queensland Direct API, for the
// app's fuel layer (see src/api/fuelStations.ts). The subscriber token is the
// FPQ_API_TOKEN setting, sent only from here. Site, brand, fuel and suburb
// lists are read every 6 hours (the licence wants site details current within
// 24) and prices every 2 minutes (the API asks for no more than once a minute;
// the licence wants price changes shown within 30). The answer is cached at
// the edge for the same 2 minutes and sends no CORS header: the licence lets
// Roadbeat publish the prices but not pass them to anyone else to publish.

const PRICES_S = 120
const DETAILS_MS = 6 * 3_600_000

async function get(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${FPQ_API}${path}`, { headers: { authorization: `FPDAPI SubscriberToken=${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Fuel Prices Queensland responded with ${res.status} for ${path.split('?')[0]}`)
  return res.json()
}

const token = () => process.env.FPQ_API_TOKEN ?? ''
const QLD = 'countryId=21&geoRegionLevel=3&geoRegionId=1'

const details = memoised(DETAILS_MS, async () => {
  const [brands, fuels, regions, sites] = await Promise.all([
    get('/Subscriber/GetCountryBrands?countryId=21', token()),
    get('/Subscriber/GetCountryFuelTypes?countryId=21', token()),
    get('/Subscriber/GetCountryGeographicRegions?countryId=21', token()),
    get(`/Subscriber/GetFullSiteDetails?${QLD}`, token()),
  ])
  return { brands, fuels, regions, sites }
})

const latest = memoised(PRICES_S * 1000, async (): Promise<FuelStation[]> => {
  const [d, prices] = await Promise.all([details(), get(`/Price/GetSitesPrices?${QLD}`, token())])
  const stations = parseFuelData({ ...d, prices })
  if (!stations.length) throw new Error('Fuel Prices Queensland listed no sites')
  return stations
})

const reply = (body: unknown, status: number, cache: string) => Response.json(body, { status, headers: { 'cache-control': cache, 'x-robots-tag': 'noindex' } })

export async function GET() {
  if (!process.env.FPQ_API_TOKEN) return reply({ error: "Fuel prices aren't set up on this server." }, 503, 'no-store')
  try {
    const stations = await latest()
    return reply({ fetchedAt: Date.now(), stations }, 200, `public, s-maxage=${PRICES_S}, stale-while-revalidate=60`)
  } catch (e) {
    console.error('Fuel prices failed:', e)
    return reply({ error: 'Fuel Prices Queensland did not respond. Try again shortly.' }, 502, 'no-store')
  }
}
