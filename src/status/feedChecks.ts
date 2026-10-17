import { fetchAirQuality } from '../api/airQuality'
import { brisbaneDate } from '../api/airHistory'
import { fetchHotspots } from '../api/hotspots'
import { latestImageryDate } from '../api/satelliteImagery'
import { latestHimawariTime } from '../api/himawari'
import { fetchQldWarnings } from '../api/qldWarnings'
import { BUS_STOPS_API, parseBusStopAudit } from '../api/bccBusStops'
import { fetchCorridors, fetchCouncilEvents, fetchPedestrianDay } from '../api/bccDashboard'
import { fetchGauges } from '../api/bccGauges'
import { fetchCarParkSpaces } from '../api/bccParking'
import { fetchAccessibleBays, fetchBikeStops, fetchClearways, fetchParkingMeters, fetchToilets } from '../api/bccPlaces'
import { fetchRoadOccupancies } from '../api/bccRoadOccupancies'
import { fetchSignalVolumes } from '../api/bccSignals'
import { fetchBushfires } from '../api/bushfires'
import { fetchClearances } from '../api/clearances'
import { fetchCameras, fetchDistricts, fetchDumpPoints, fetchEvents, fetchRestAreas, fetchTruckRestrictions, fetchWaze, QLDTRAFFIC_DATA_BASE, RAIN_RADAR } from '../api/client'
import { FERRY_TERMINALS_API, parseFerryTerminal } from '../api/ferryTerminals'
import { fetchCrashSummary } from '../api/crashes'
import { fetchNews } from '../api/news'
import { fetchQldGauges } from '../api/qldGauges'
import { parseStationFacilities, STATION_FACILITIES_API } from '../api/stationFacilities'
import { fetchTransitAlerts, fetchTripUpdates, fetchVehicles } from '../api/translink'
import type { Gauge } from '../api/gaugeTypes'
import type { SourceStatus } from '../api/newsTypes'
import type { PublisherTime } from '../lib/feedHealth'
import type { FeedId } from '../lib/feedRegistry'
import { MAIN_REGIONS, PROBED_REGIONS } from '../lib/transitRegions'

// One check per feed in the registry, through the same fetch and parse
// functions the app uses, so a feed counts as healthy only when its data
// parses. A feed the page cannot read on its own is marked with the reason,
// never guessed at. tsc holds this list to the registry's ids.

/** What a check found: the publisher's own time on the feed, where it gives one. */
export interface CheckResult {
  publisherTime: PublisherTime | null
  /** The news monitor's per-source statuses from its snapshot; other feeds have none. */
  sources?: SourceStatus[]
}

export type FeedCheck = (signal: AbortSignal) => Promise<CheckResult>

const REGIONS = [...MAIN_REGIONS]
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
/** Brisbane's GPO, for a crash summary that exercises the live query. */
const BRISBANE: [number, number] = [153.0251, -27.4698]

const none = (): CheckResult => ({ publisherTime: null })

/** The latest reading the gauges carry, or null when no gauge has one. */
function latestReading(gauges: Gauge[]): PublisherTime | null {
  const at = Math.max(0, ...gauges.flatMap((g) => g.readings.map((r) => r.time)))
  return at ? { at, label: 'Latest reading' } : null
}

/** One record from a council records endpoint, parsed as the app would parse a stop's own record. */
async function firstRecord(api: string, parse: (raw: unknown) => unknown, signal: AbortSignal) {
  const res = await fetch(`${api}?limit=1`, { signal })
  if (!res.ok) throw new Error(`Brisbane City Council responded with ${res.status}`)
  const body: unknown = await res.json()
  const results = typeof body === 'object' && body && 'results' in body && Array.isArray(body.results) ? body.results : null
  if (!results?.length) throw new Error('The dataset returned no records')
  if (!parse(results[0])) throw new Error('The first record did not parse')
  return none()
}

async function jsonAt(url: string, signal: AbortSignal, what: string) {
  const res = await fetch(url, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`${what} responded with ${res.status}`)
  const text = await res.text()
  if (!text.trim()) throw new Error(`${what} answered with an empty body`)
  JSON.parse(text)
  return none()
}

export const CHECKS: Record<FeedId, FeedCheck | { skip: string }> = {
  events: async (signal) => {
    const { published } = await fetchEvents(signal)
    const at = published ? Date.parse(published) : NaN
    return { publisherTime: Number.isNaN(at) ? null : { at, label: 'Published' } }
  },
  cameras: (signal) => fetchCameras(signal).then(none),
  'rest-areas': () => Promise.all([fetchRestAreas(), fetchDumpPoints(), fetchTruckRestrictions()]).then(none),
  waze: () => fetchWaze().then(none),
  districts: () => fetchDistricts().then(none),
  'rain-radar': (signal) =>
    // The service sends no CORS headers, so the layer loads it as an image; so does this check, a small frame over Brisbane.
    new Promise<CheckResult>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(none())
      img.onerror = () => reject(new Error('The radar image did not load'))
      signal.addEventListener('abort', () => {
        img.src = ''
        reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'))
      })
      img.src = `${RAIN_RADAR}?bounds=-27.9,152.6,-27.0,153.5&width=64&height=64&t=${Date.now()}`
    }),
  'translink-status': (signal) => jsonAt(`${QLDTRAFFIC_DATA_BASE}/translink/serviceNotice.json`, signal, 'QLDTraffic'),
  vehicles: (signal) => fetchVehicles(REGIONS, signal).then(none),
  'trip-updates': (signal) => fetchTripUpdates(REGIONS, signal).then(none),
  'service-alerts': (signal) => fetchTransitAlerts(REGIONS, signal).then(none),
  // Healthy when any regional feed parses, empty or not; most are empty.
  'regional-realtime': (signal) => fetchTripUpdates([...PROBED_REGIONS], signal).then(none),
  bushfires: (signal) => fetchBushfires(signal).then(none),
  // Healthy when the feed parses, empty or not. Its own timestamps are when it was regenerated, not issue times, so none is shown.
  'qld-warnings': (signal) => fetchQldWarnings(signal).then(none),
  'bcc-gauges': (signal) => fetchGauges(signal).then((g) => ({ publisherTime: latestReading(g) })),
  'qld-gauges': (signal) => fetchQldGauges(signal).then((g) => ({ publisherTime: latestReading(g) })),
  signals: async (signal) => {
    const volumes = await fetchSignalVolumes(signal)
    const at = Math.max(0, ...[...volumes.values()].flat().map((a) => a.recorded))
    return { publisherTime: at ? { at, label: 'Latest cycle' } : null }
  },
  'station-facilities': (signal) => firstRecord(STATION_FACILITIES_API, parseStationFacilities, signal),
  'road-occupancies': (signal) => fetchRoadOccupancies(signal).then(none),
  parking: async (signal) => {
    const spaces = await fetchCarParkSpaces(signal)
    return { publisherTime: spaces ? { at: spaces.at, label: 'Published' } : null }
  },
  clearances: (signal) => fetchClearances(signal).then(none),
  clearways: (signal) => fetchClearways(signal).then(none),
  toilets: (signal) => fetchToilets(signal).then(none),
  'accessible-parking': (signal) => fetchAccessibleBays(signal).then(none),
  'parking-meters': (signal) => fetchParkingMeters(signal).then(none),
  'bike-racks': (signal) => fetchBikeStops(signal).then(none),
  'bus-stops': (signal) => firstRecord(BUS_STOPS_API, parseBusStopAudit, signal),
  'ferry-terminals': (signal) => firstRecord(FERRY_TERMINALS_API, parseFerryTerminal, signal),
  corridors: (signal) => fetchCorridors(Date.now(), signal).then(none),
  'council-events': (signal) => {
    const now = Date.now()
    return fetchCouncilEvents(now, now + 48 * 3600_000, signal).then(none)
  },
  pedestrians: (signal) => fetchPedestrianDay(dayKey.format(Date.now() - 24 * 3600_000), signal).then(none),
  'air-quality': async (signal) => {
    const stations = await fetchAirQuality(signal)
    const at = Math.max(0, ...stations.map((s) => s.measuredAt))
    return { publisherTime: at ? { at, label: 'Measured hour' } : null }
  },
  hotspots: async (signal) => {
    const newest = (await fetchHotspots(signal))[0]
    return { publisherTime: newest ? { at: newest.observedAt, label: 'Newest detection' } : null }
  },
  'satellite-imagery': async (signal) => {
    const date = await latestImageryDate(brisbaneDate(Date.now()), signal)
    if (!date) throw new Error('No image published over Brisbane in the last four days')
    return { publisherTime: { at: Date.parse(`${date}T00:00:00+10:00`), label: 'Newest image (day)' } }
  },
  himawari: async (signal) => {
    const time = await latestHimawariTime('infrared', Date.now(), signal)
    if (!time) throw new Error('No Himawari-9 infrared image listed in the last day')
    return { publisherTime: { at: Date.parse(time), label: 'Newest infrared image' } }
  },
  crashes: (signal) => fetchCrashSummary(BRISBANE, signal).then(none),
  'camera-time': { skip: 'Asked only for a pinned camera’s image; nothing to ask without one' },
  'base-maps': (signal) => jsonAt('https://tiles.openfreemap.org/styles/positron', signal, 'OpenFreeMap'),
  news: async (signal) => {
    const snapshot = await fetchNews(signal)
    return { publisherTime: { at: snapshot.fetchedAt, label: 'Feeds read' }, sources: snapshot.sources }
  },
}
