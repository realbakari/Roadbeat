import type { Gauge } from '../api/bccGauges'
import type { SignalSite, SignalVolumes } from '../api/bccSignals'
import { FIRE_COLOR, fireKindLabel, type FireWarning } from '../api/bushfires'
import { clearanceLabel } from '../api/clearances'
import type { LiveVehicle } from '../api/transitTypes'
import { routeInfo } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { typeMeta } from './eventMeta'
import { eventPlace, eventTitle } from './eventText'
import { clean, timeAgo } from './format'
import { latestReading, rainfallTotal } from './gauges'
import { eventAnchor, type LngLat } from './geo'
import { LAYER_COLOR, VEHICLE_COLOR } from './mapIcons'
import { placeFocus, type Place } from './places'
import { CENTRE_COLOR, centreKind } from './councilCentres'
import { OUTAGE_COLOR, outageFacts } from './outages'
import { AIR_COLOR, AIR_RATINGS, worstRating } from '../api/airQuality'
import { HOTSPOT_COLOR } from '../api/hotspots'
import { WARNING_COLOR } from '../api/qldWarnings'
import { NSW_ALERT_COLOR } from '../api/nswFires'
import { SPEED_CAMERA_LABEL } from '../api/speedCameras'
import { PAST_CYCLONE_COLOR, pastCycloneTitle } from '../api/pastCyclones'
import { CYCLONE_COLOR } from '../api/jtwc'
import { storyLocatedLine, storySourceLine, type NewsStory } from './newsStories'
import { dsColor, siteLoad } from './signals'
import { truckKey } from './trucks'
import { wazeLabel } from './waze'
import { brisbaneDayClock as observed, brisbaneClock as clock } from './aest'

/**
 * A short card for a selected map item, shown on the map itself when the side
 * panel is hidden. Everything on it is a published value; the panel has the rest.
 */
export interface MapCard {
  /** A stable key, so a new selection remounts the card. */
  key: string
  title: string
  subtitle: string | null
  /** Up to two short lines of the item's key published facts. */
  facts: string[]
  /** The item's colour on the map, for the card's accent. */
  color: string
  /** A published picture of the item, shown above the title. */
  image?: string
  position: LngLat
  /** False for an item whose position isn't somewhere to drive to, such as a town a news story names. */
  directions?: boolean
}

/** A detection's time, with the day, since the layer spans the last 24 hours. */

export function eventCard(e: TrafficEvent): MapCard | null {
  const position = eventAnchor(e)
  if (!position) return null
  const p = e.properties
  const impact = clean(p.impact?.impact_subtype) ?? clean(p.impact?.impact_type)
  return {
    key: `event-${p.id}`,
    title: eventTitle(e),
    subtitle: eventPlace(e) || null,
    facts: [[p.event_type, clean(p.event_subtype)].filter(Boolean).join(' · '), [impact, `${p.event_priority} priority`].filter(Boolean).join(' · ')],
    color: typeMeta(p.event_type).color,
    position,
  }
}

const PLACE_SUBTITLE: Record<Place['kind'], string> = {
  rest: 'Rest area',
  dump: 'RV dump point',
  truck: 'Heavy vehicle restriction',
  waze: 'Reported by Waze users',
  clearance: 'Low clearance',
  clearway: 'Clearway',
  toilet: 'Public toilet',
  bay: 'Accessible parking',
  meter: 'Parking meter',
  bike: 'Bike rack',
  event: 'Council event',
  centre: 'Council centre',
  outage: 'Outage',
  air: 'Air quality station',
  hotspot: 'Heat detected by satellite',
  warning: 'Queensland warning',
  nswfire: 'NSW Rural Fire Service incident',
  cyclone: 'JTWC warning, not the official Australian warning',
  pastcyclone: 'Past cyclone track, IBTrACS',
  speedcamera: 'Camera site, Queensland Government',
}

function placeTitle(place: Place): string {
  switch (place.kind) {
    case 'rest':
      return place.data.name ?? 'Rest area'
    case 'dump':
      return place.data.name
    case 'truck':
      return place.data.properties.name
    case 'waze':
      return [place.data.street, place.data.city].filter(Boolean).join(', ') || `${wazeLabel(place.data)} reported`
    case 'clearance':
      return place.data.title
    case 'clearway':
      return place.data.times ?? 'Clearway'
    case 'toilet':
      return place.data.name
    case 'bay':
    case 'meter':
      return place.data.street ?? PLACE_SUBTITLE[place.kind]
    case 'bike':
      return place.data.name
    case 'event':
      return place.data.title
    case 'centre':
      return place.data.name
    case 'outage':
      return place.data.title
    case 'air':
      return place.data.name
    case 'hotspot':
      return 'Satellite hotspot'
    case 'warning':
      return place.data.area ?? 'Queensland warning'
    case 'nswfire':
      return place.data.title
    case 'cyclone':
      return place.data.name ? `Tropical cyclone ${place.data.name} (${place.data.id})` : `Tropical cyclone ${place.data.id}`
    case 'pastcyclone':
      return pastCycloneTitle(place.data)
    case 'speedcamera':
      return place.data.site || SPEED_CAMERA_LABEL[place.data.type]
  }
}

export function placeCard(place: Place): MapCard | null {
  const focus = placeFocus(place)
  if (!focus) return null
  const facts: string[] = []
  if (place.kind === 'clearance') facts.push(`${clearanceLabel(place.data.metres)} signed clearance`)
  if (place.kind === 'toilet') facts.push(place.data.accessible ? 'Accessible toilet' : 'No accessible toilet listed')
  if (place.kind === 'meter' && place.data.rate != null) facts.push(`$${place.data.rate.toFixed(2)} an hour${place.data.maxStayHours != null ? ` · ${place.data.maxStayHours} h max` : ''}`)
  if (place.kind === 'bike' && place.data.kind === 'repair') facts.push('Bike repair station')
  if ((place.kind === 'bay' || place.kind === 'meter') && place.data.suburb) facts.push(place.data.suburb)
  if (place.kind === 'event') facts.push(...[place.data.when, place.data.venue].filter((f) => f != null))
  if (place.kind === 'centre') facts.push(...[place.data.status ? `Status: ${place.data.status}` : null, place.data.address].filter((f) => f != null))
  if (place.kind === 'outage') facts.push(...outageFacts(place.data))
  if (place.kind === 'air') {
    const worst = worstRating(place.data)
    facts.push(worst ? `${AIR_RATINGS[worst - 1]} · worst rated value` : 'No rated value this hour', `Values as of ${clock.format(place.data.measuredAt)}`)
  }
  if (place.kind === 'hotspot') {
    const h = place.data
    facts.push(`${h.satellite}${h.sensor ? ` · ${h.sensor}` : ''} · ${observed.format(h.observedAt)}`, h.accuracy ? `Position ${h.accuracy}` : 'Position accuracy not published')
  }
  if (place.kind === 'warning') {
    const w = place.data
    facts.push(...[w.callToAction, w.issued ? `${w.issued} (AEST)` : null].filter((f) => f != null))
  }
  if (place.kind === 'nswfire') facts.push(...[place.data.alertLevel, place.data.fields.find(([k]) => k === 'Status')?.[1]].filter((f): f is string => !!f))
  if (place.kind === 'cyclone') {
    const c = place.data
    facts.push(`Warning ${c.warning ?? '?'} · ${observed.format(c.issuedAt)} AEST`, c.points[0].windKt ? `${c.points[0].windKt} kt at the warning position` : 'Wind not published')
  }
  if (place.kind === 'pastcyclone') facts.push(place.data.peakKt ? `Peak ${place.data.peakKt} kt (${place.data.agency ?? 'WMO agency'})` : 'Peak wind not recorded', 'History, not a current warning')
  if (place.kind === 'speedcamera') facts.push(SPEED_CAMERA_LABEL[place.data.type])
  const colors: Record<Place['kind'], string> = {
    rest: LAYER_COLOR.restArea,
    dump: LAYER_COLOR.dumpPoint,
    truck: LAYER_COLOR.truck,
    waze: LAYER_COLOR.waze,
    clearance: LAYER_COLOR.clearance,
    clearway: LAYER_COLOR.clearwayOn,
    toilet: LAYER_COLOR.toiletAccessible,
    bay: LAYER_COLOR.accessibleParking,
    meter: LAYER_COLOR.parkingMeter,
    bike: LAYER_COLOR.bikeRack,
    event: LAYER_COLOR.councilEvent,
    centre: place.kind === 'centre' ? CENTRE_COLOR[centreKind(place.data.type)] : '',
    outage: place.kind === 'outage' ? OUTAGE_COLOR[place.data.source] : '',
    air: place.kind === 'air' ? AIR_COLOR[worstRating(place.data) ?? 0] : '',
    hotspot: HOTSPOT_COLOR,
    warning: place.kind === 'warning' ? WARNING_COLOR[place.data.level] : '',
    nswfire: place.kind === 'nswfire' ? (NSW_ALERT_COLOR[place.data.alertLevel] ?? NSW_ALERT_COLOR['Not Applicable']) : '',
    cyclone: CYCLONE_COLOR,
    pastcyclone: PAST_CYCLONE_COLOR,
    speedcamera: place.kind === 'speedcamera' ? (place.data.type === 'fixed' ? LAYER_COLOR.speedCamera : place.data.type === 'p2p' ? LAYER_COLOR.p2pCamera : LAYER_COLOR.redLightCamera) : '',
  }
  return {
    key: `place-${place.kind}-${placeId(place)}`,
    title: placeTitle(place),
    subtitle:
      place.kind === 'bike' && place.data.kind === 'repair'
        ? 'Bike repair station'
        : place.kind === 'centre'
          ? `${place.data.type} · ${place.data.council}`
          : place.kind === 'waze'
            ? `${wazeLabel(place.data)} reported by Waze users`
            : place.kind === 'warning'
            ? [place.data.levelText, place.data.from].filter(Boolean).join(' · ')
            : place.kind === 'outage'
            ? `${place.data.type} ${place.data.source === 'energex' ? 'outage reported by Energex' : `notice · ${place.data.council}`}`
            : PLACE_SUBTITLE[place.kind],
    facts: facts.slice(0, 2),
    color: colors[place.kind],
    ...(place.kind === 'event' && place.data.image ? { image: place.data.image } : {}),
    position: focus.center,
  }
}

function placeId(place: Place): string {
  switch (place.kind) {
    case 'truck':
      return truckKey(place.data)
    case 'waze':
      return place.data.uuid
    default:
      return place.data.id
  }
}

export function fireCard(f: FireWarning): MapCard {
  return {
    key: `fire-${f.id}`,
    title: f.area ?? f.title,
    subtitle: f.level === 'Information' ? fireKindLabel(f) : f.levelText,
    facts: [f.callToAction ?? f.location ?? '', f.issued ? `Issued ${clock.format(f.issued)}` : ''].filter(Boolean),
    color: FIRE_COLOR[f.level],
    position: f.position,
  }
}

export function gaugeCard(g: Gauge, now: number): MapCard {
  const latest = latestReading(g)
  const rain = g.kind === 'rain' ? rainfallTotal(g, now - 3600_000) : null
  const fact =
    g.kind === 'stream'
      ? latest
        ? `${latest.value.toFixed(2)} m${g.source === 'bcc' ? ' AHD' : ''} at ${clock.format(latest.time)}`
        : 'No reading in the last 24 hours'
      : rain != null
        ? `${rain} mm in the last hour`
        : `No reading in the last hour${latest ? ` · last at ${clock.format(latest.time)}` : ''}`
  return {
    key: `gauge-${g.id}`,
    title: g.name,
    subtitle: g.kind === 'stream' ? 'Stream height gauge' : 'Rain gauge',
    facts: [fact, g.source === 'bcc' ? 'Brisbane City Council' : 'Queensland Government'],
    color: g.kind === 'stream' ? '#0369a1' : '#0d9488',
    position: g.position,
  }
}

export function signalCard(site: SignalSite, volumes: SignalVolumes | null, now: number): MapCard {
  const approaches = volumes?.get(site.tsc)
  const load = approaches?.length ? siteLoad(approaches) : null
  return {
    key: `signal-${site.tsc}`,
    title: site.streets.length ? site.streets.join(' & ') : `Signal ${site.tsc}`,
    subtitle: ['Traffic signals', site.suburb].filter(Boolean).join(' · '),
    facts: load
      ? [`Busiest lane ${Math.round(load.maxDs)}% saturated`, `${load.vehicles} vehicles in the last cycle, ${timeAgo(load.recorded, now)}`]
      : ['No volumes in the latest batch'],
    color: load ? dsColor(load.maxDs) : '#6b7280',
    position: site.position,
  }
}

const VEHICLE_STATUS = { stopped: 'Stopped at a stop', arriving: 'Arriving at a stop', moving: 'Moving' } as const

export function vehicleCard(v: LiveVehicle, now: number): MapCard {
  const info = routeInfo(v.route, v.region)
  const label = v.mode === 'train' ? (v.lineName ?? `Train ${v.route}`) : `${v.mode[0].toUpperCase()}${v.mode.slice(1)} ${info?.short ?? v.route}`
  return {
    key: `vehicle-${v.id}`,
    title: label,
    subtitle: v.routeName ?? null,
    facts: [v.status ? VEHICLE_STATUS[v.status] : 'Live position', `Reported ${timeAgo(v.timestamp, now)}`],
    color: VEHICLE_COLOR[v.mode],
    position: v.position,
  }
}

/** A news story's card, at the first place it names. Never offers directions: the pin is a named town, not an incident site. */
export function newsCard(s: NewsStory, now: number): MapCard | null {
  const place = s.places[0]
  if (!place) return null
  return {
    key: `news-${s.id}`,
    title: s.items[0].title,
    subtitle: storySourceLine(s),
    facts: [timeAgo(s.latest, now) ?? '', storyLocatedLine(s) ?? ''].filter(Boolean),
    color: s.kind === 'official' ? LAYER_COLOR.newsOfficial : LAYER_COLOR.news,
    position: place.position,
    directions: false,
  }
}

export interface MapSelection {
  event: TrafficEvent | null
  place: Place | null
  fire: FireWarning | null
  gauge: Gauge | null
  signal: SignalSite | null
  signalVolumes: SignalVolumes | null
  vehicle: LiveVehicle | null
  story: NewsStory | null
}

/** The card for whichever map item is selected, or null when nothing with a card is. */
export function mapCardFor(s: MapSelection, now: number): MapCard | null {
  if (s.event) return eventCard(s.event)
  if (s.place) return placeCard(s.place)
  if (s.fire) return fireCard(s.fire)
  if (s.gauge) return gaugeCard(s.gauge, now)
  if (s.signal) return signalCard(s.signal, s.signalVolumes, now)
  if (s.vehicle) return vehicleCard(s.vehicle, now)
  if (s.story) return newsCard(s.story, now)
  return null
}

