import type { AirStation } from '../api/airQuality'
import type { FireWarning } from '../api/bushfireFeed'
import type { Gauge } from '../api/gaugeTypes'
import type { QldWarning, WarningLevel } from '../api/qldWarnings'
import type { CouncilCentre, NewsItem, NewsPlace, Outage } from '../api/newsTypes'
import type { Camera, TrafficEvent } from '../api/types'
import { StopIndex } from '../api/stops'
import type { ScheduledStop, ScheduledTrip, StopKind } from '../api/timetables'

/** A small network: two stations with platforms, plus one bus stop. */
export function stopIndex() {
  return new StopIndex().add({
    stops: {
      SEQ: [
        ['place_a', 'Alpha station', -27.4, 153.0, 0, 0],
        ['a1', 'Alpha station, platform 1', -27.4, 153.0, 'place_a', '1'],
        ['a2', 'Alpha station, platform 2', -27.4, 153.0, 'place_a', '2'],
        ['place_b', 'Bravo station', -27.5, 153.0, 0, 0],
        ['b1', 'Bravo station, platform 1', -27.5, 153.0, 'place_b', '1'],
        ['b2', 'Bravo station, platform 2', -27.5, 153.0, 'place_b', '2'],
        ['c1', 'Charlie station', -27.6, 153.0, 0, 0],
        ['d1', 'Delta stop', -27.7, 153.0, 0, 0],
      ],
    },
  })
}

const T0 = Date.parse('2026-10-15T00:00:00+10:00')
/** Minutes after midnight on 15 Oct 2026 in Brisbane, as a timestamp. */
export const at = (minutes: number) => T0 + minutes * 60_000

/** A trip from [stop id, departure minute, arrival minute?, kind?] tuples. */
export function trip(number: number, route: string, stops: [string, number, number?, StopKind?][]): ScheduledTrip {
  return {
    key: `SEQ-${number}-2026-10-15`,
    region: 'SEQ',
    route,
    number,
    date: '2026-10-15',
    headsign: 'Somewhere',
    direction: 0,
    stops: stops.map(
      ([stopId, dep, arr, kind]): ScheduledStop => ({ stopId, time: at(dep), arrival: at(arr ?? dep), kind: kind ?? 'normal' }),
    ),
  }
}

/** A news monitor item: an ABC report with no summary, places or roads unless overridden. */
export function newsItem(over: Partial<NewsItem> = {}): NewsItem {
  const id = over.id ?? 'a'
  return {
    id,
    source: 'abc-qld',
    publisher: 'ABC',
    kind: 'news',
    title: 'Headline',
    link: `https://example.com/${id}`,
    published: 0,
    updated: null,
    summary: null,
    places: [],
    roads: [],
    area: null,
    icon: null,
    ...over,
  }
}

/** A place matched from the gazetteer, at a given point. */
export function gazetteerPlace(name: string, lga: string, position: [number, number] = [0, 0]): NewsPlace {
  return { name, lga, position, via: 'gazetteer' }
}

/** A QLDTraffic road event on a road in a locality: a crash in effect unless overridden. */
export function roadEvent(
  id: number,
  road: string,
  locality: string | null,
  over: Partial<Pick<TrafficEvent['properties'], 'event_type' | 'duration'>> = {},
): TrafficEvent {
  return {
    type: 'Feature',
    geometry: null,
    properties: {
      id,
      status: 'Published',
      published: null,
      source: null,
      url: '',
      event_type: over.event_type ?? 'Crash',
      event_subtype: null,
      event_due_to: null,
      impact: { direction: null, towards: null, impact_type: 'Lanes', impact_subtype: null, delay: null },
      duration: over.duration ?? null,
      event_priority: 'High',
      description: null,
      advice: null,
      information: null,
      road_summary: { road_name: road, locality, postcode: null, local_government_area: null, district: 'Metropolitan' },
      last_updated: null,
      next_inspection: null,
      web_link: null,
    },
  }
}

/** A QFD warning with only an id, level, area and title set. */
export function fireWarning(id: string, area: string | null, title = 'Bushfire'): FireWarning {
  return {
    id,
    level: 'Advice',
    levelText: 'Advice',
    title,
    area,
    location: null,
    status: null,
    kind: 'FIRE VEGETATION',
    callToAction: null,
    header: null,
    impacts: null,
    shouldDo: null,
    leaveSafely: null,
    further: null,
    text: null,
    position: [0, 0],
    areaShape: null,
    issued: null,
    published: null,
    expires: null,
  }
}

/** A Queensland Disaster Management flood warning at a level, with a marker and no area. */
export function qldWarning(id: string, level: WarningLevel, area: string, position: [number, number] = [150, -25]): QldWarning {
  return {
    id,
    level,
    levelText: level,
    title: `${level} - ${area}`,
    issued: null,
    type: 'Flood',
    area,
    from: null,
    callToAction: null,
    header: null,
    impacts: null,
    shouldDo: null,
    moreInformation: null,
    nextUpdate: null,
    position,
    areaShape: null,
  }
}

/** A QLDTraffic camera at a point, filed under a locality. */
export function camera(id: number, locality: string | null, coordinates: [number, number], kind: Camera['kind'] = 'webcam'): Camera {
  return {
    type: 'Feature',
    kind,
    geometry: { type: 'Point', coordinates },
    properties: { id, url: '', description: `${locality ?? 'Camera'} - Road`, direction: null, district: null, locality, postcode: null, image_url: `https://cameras.qldtraffic.qld.gov.au/${id}.jpg` },
  }
}

/** An air quality station at a point, with no readings. */
export function airStation(id: string, position: [number, number]): AirStation {
  return { id, name: id, region: 'South East Queensland', link: `https://apps.des.qld.gov.au/air-quality/stations/?station=${id}`, position, measuredAt: 0, measurements: [] }
}

/** A council's evacuation centre at a point. */
export function councilCentre(id: string, position: [number, number]): CouncilCentre {
  return { id, council: 'Ipswich City Council', area: 'Ipswich City', type: 'Evacuation Centre', name: id, address: null, status: null, note: null, position, dashboard: 'https://disaster.ipswich.qld.gov.au' }
}

/** An Energex outage placed by its suburb's gazetteer point, or a council notice with no suburb when `suburb` is null. */
export function outage(id: string, suburb: string | null): Outage {
  return {
    id,
    source: suburb ? 'energex' : 'council',
    council: 'Ipswich City Council',
    area: 'Ipswich City',
    type: suburb ? 'Power' : 'Water',
    title: suburb ? `Power outage, ${suburb}` : 'Water works',
    details: null,
    status: null,
    customers: null,
    streets: [],
    start: null,
    end: null,
    updated: null,
    geometry: null,
    place: suburb ? gazetteerPlace(suburb, 'Ipswich City') : null,
    dashboard: 'https://disaster.ipswich.qld.gov.au',
  }
}

/** A council stream gauge at a point, with no readings. */
export function gauge(id: string, position: [number, number]): Gauge {
  return { id, name: id, kind: 'stream', source: 'bcc', unit: 'm', position, readings: [] }
}
