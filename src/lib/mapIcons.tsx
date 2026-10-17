import {
  BoatIcon,
  BusIcon,
  TrainIcon,
  TramIcon,
  CameraIcon,
  PicnicTableIcon,
  ChatTeardropDotsIcon,
  TruckIcon,
  VanIcon,
  VideoCameraIcon,
  FlameIcon,
  CampfireIcon,
  TrafficSignalIcon,
  ToiletIcon,
  WheelchairIcon,
  LetterCirclePIcon,
  BicycleIcon,
  WrenchIcon,
  CalendarStarIcon,
  WarningIcon,
  HouseLineIcon,
  PackageIcon,
  MapPinIcon,
  LightningIcon,
  MegaphoneSimpleIcon,
  WindIcon,
  DropHalfBottomIcon,
  CloudRainIcon,
  GaugeIcon,
  type Icon,
  type IconWeight,
} from '@phosphor-icons/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CAMERA_COLOR, EVENT_TYPES } from './eventMeta'
import { FIRE_COLOR, FIRE_LEVELS } from '../api/bushfires'
import { DS_BANDS } from './signals'
import { CENTRE_COLOR } from './councilCentres'
import { OUTAGE_COLOR } from './outages'
import { AIR_COLOR } from '../api/airQuality'
import { NSW_ALERT_COLOR } from '../api/nswFires'

// Map icons are drawn as SVG badges (Phosphor glyph on a coloured disc or
// rounded square), rasterised once, and registered with MapLibre as images.

const SIZE = 30 // logical px; registered at 2x for crisp rendering
const CLOSURE_RED = '#dc2626'

export const LAYER_COLOR = {
  restArea: '#15803d',
  hvRestArea: '#166534',
  dumpPoint: '#7c3aed',
  waze: '#0ea5e9',
  truck: '#b91c1c',
  /** Yellow, like a low clearance sign. */
  clearance: '#facc15',
  /** Red when a clearway is in effect, like the sign's tow-away panel. */
  clearwayOn: '#dc2626',
  clearwayOff: '#9ca3af',
  toilet: '#475569',
  toiletAccessible: '#0369a1',
  /** The international symbol of access is white on blue. */
  accessibleParking: '#1d4ed8',
  flood2022: '#2563eb',
  parkingMeter: '#334155',
  bikeRack: '#16a34a',
  bikeRepair: '#15803d',
  councilEvent: '#be185d',
  news: '#7c3aed',
  newsOfficial: '#0f172a',
  speedCamera: '#0f172a',
  redLightCamera: '#b91c1c',
  p2pCamera: '#c2410c',
} as const

export const VEHICLE_COLOR = {
  bus: '#059669',
  train: '#4f46e5',
  tram: '#db2777',
  ferry: '#0284c7',
} as const

/** The glyph's size inside a 30-unit badge: large enough to read at the 16 to 20 px the map draws low-priority markers. */
const GLYPH = 19

function glyph(I: Icon, color: string, size = GLYPH, weight: IconWeight = 'fill') {
  const svg = renderToStaticMarkup(<I size={size} weight={weight} color={color} />)
  const off = (SIZE - size) / 2
  return svg.replace('<svg ', `<svg x="${off}" y="${off}" `)
}

function wrap(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * 2}" height="${SIZE * 2}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`
}

const shadow = `<circle cx="15" cy="15.8" r="13" fill="rgba(0,0,0,.25)"/>`

function disc(fill: string, I: Icon, weight: IconWeight = 'fill') {
  return wrap(`${shadow}<circle cx="15" cy="15" r="13" fill="${fill}" stroke="#fff" stroke-width="2"/>${glyph(I, '#fff', GLYPH, weight)}`)
}

/** Outline style for upcoming roadworks/special events, like the official "future" pins. */
function ring(color: string, I: Icon, weight: IconWeight = 'fill') {
  return wrap(`${shadow}<circle cx="15" cy="15" r="12.5" fill="#fff" stroke="${color}" stroke-width="3"/>${glyph(I, color, 17, weight)}`)
}

function square(fill: string, I: Icon) {
  return wrap(
    `<rect x="2" y="2.8" width="26" height="26" rx="7" fill="rgba(0,0,0,.25)"/><rect x="2" y="2" width="26" height="26" rx="7" fill="${fill}" stroke="#fff" stroke-width="2"/>${glyph(I, '#fff')}`,
  )
}

/** A prohibition sign: the glyph in a white disc under a red ring and slash, like the "no trucks" sign. */
function prohibition(I: Icon) {
  return wrap(
    `${shadow}<circle cx="15" cy="15" r="13" fill="#fff" stroke="#fff" stroke-width="2"/>${glyph(I, '#1f2937', 14)}` +
      `<circle cx="15" cy="15" r="11.5" fill="none" stroke="${CLOSURE_RED}" stroke-width="3"/><line x1="7" y1="7" x2="23" y2="23" stroke="${CLOSURE_RED}" stroke-width="3" stroke-linecap="round"/>`,
  )
}

/** Red no-entry sign with ALL / THRU, matching QLDTraffic's closure pins. */
function closure(label: string) {
  const fs = label.length > 3 ? 6.4 : 7.5
  return wrap(
    `${shadow}<circle cx="15" cy="15" r="13" fill="${CLOSURE_RED}" stroke="#fff" stroke-width="2"/>` +
      `<rect x="5.5" y="11.2" width="19" height="7.6" rx="1.5" fill="#fff"/>` +
      `<text x="15" y="17.3" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="700" font-size="${fs}" fill="${CLOSURE_RED}">${label}</text>`,
  )
}

export function typeSlug(type: string) {
  return type.toLowerCase().replace(/\s+/g, '-')
}

function buildIcons(): Record<string, string> {
  const icons: Record<string, string> = {}
  for (const m of EVENT_TYPES) {
    // Phosphor's filled waves render as a solid tile at map size, so flooding uses the bold outline.
    const weight: IconWeight = m.type === 'Flooding' ? 'bold' : 'fill'
    icons[`event-${typeSlug(m.type)}`] = disc(m.color, m.icon, weight)
    icons[`event-${typeSlug(m.type)}-future`] = ring(m.color, m.icon, weight)
  }
  icons['closure-all'] = closure('ALL')
  icons['closure-thru'] = closure('THRU')
  icons['camera-webcam'] = disc(CAMERA_COLOR.webcam, VideoCameraIcon)
  icons['camera-floodcam'] = disc(CAMERA_COLOR.floodcam, CameraIcon)
  icons['rest-area'] = square(LAYER_COLOR.restArea, PicnicTableIcon)
  icons['rest-area-hv'] = square(LAYER_COLOR.hvRestArea, TruckIcon)
  icons['dump-point'] = square(LAYER_COLOR.dumpPoint, VanIcon)
  icons['waze'] = disc(LAYER_COLOR.waze, ChatTeardropDotsIcon)
  icons['waze-hazard'] = disc(LAYER_COLOR.waze, WarningIcon)
  icons['truck-restriction'] = prohibition(TruckIcon)
  icons['toilet'] = square(LAYER_COLOR.toilet, ToiletIcon)
  icons['toilet-accessible'] = square(LAYER_COLOR.toiletAccessible, ToiletIcon)
  icons['accessible-parking'] = square(LAYER_COLOR.accessibleParking, WheelchairIcon)
  icons['parking-meter'] = square(LAYER_COLOR.parkingMeter, LetterCirclePIcon)
  icons['bike-rack'] = disc(LAYER_COLOR.bikeRack, BicycleIcon)
  icons['bike-repair'] = disc(LAYER_COLOR.bikeRepair, WrenchIcon)
  icons['council-event'] = square(LAYER_COLOR.councilEvent, CalendarStarIcon)
  icons['vehicle-bus'] = disc(VEHICLE_COLOR.bus, BusIcon)
  icons['vehicle-train'] = disc(VEHICLE_COLOR.train, TrainIcon)
  icons['vehicle-tram'] = disc(VEHICLE_COLOR.tram, TramIcon)
  icons['vehicle-ferry'] = disc(VEHICLE_COLOR.ferry, BoatIcon)
  for (const level of FIRE_LEVELS) {
    icons[fireIcon(level)] = disc(FIRE_COLOR[level], FlameIcon)
    icons[fireIcon(level, 'FIRE PERMITTED BURN')] = disc(FIRE_COLOR[level], CampfireIcon)
  }
  DS_BANDS.forEach(([, color], band) => (icons[signalIcon(band)] = disc(color, TrafficSignalIcon)))
  // Layers that used to be plain dots, each now with a glyph that says what it is.
  icons['centre-shelter'] = square(CENTRE_COLOR.shelter, HouseLineIcon)
  icons['centre-sandbag'] = square(CENTRE_COLOR.sandbag, PackageIcon)
  icons['centre-other'] = square(CENTRE_COLOR.other, MapPinIcon)
  icons['outage-energex'] = disc(OUTAGE_COLOR.energex, LightningIcon)
  icons['outage-council'] = disc(OUTAGE_COLOR.council, MegaphoneSimpleIcon)
  for (const [rating, color] of Object.entries(AIR_COLOR)) icons[`air-${rating}`] = disc(color, WindIcon)
  icons['gauge-stream'] = disc('#0369a1', DropHalfBottomIcon)
  icons['gauge-rain'] = disc('#0d9488', CloudRainIcon)
  for (const [level, color] of Object.entries(NSW_ALERT_COLOR)) icons[nswFireIcon(level)] = disc(color, FlameIcon)
  // Camera sites are squares, like the signs that warn of them: a camera for speed, a signal for red light, a speedometer for point-to-point.
  icons['speedcam-fixed'] = square(LAYER_COLOR.speedCamera, CameraIcon)
  icons['speedcam-combined'] = square(LAYER_COLOR.redLightCamera, CameraIcon)
  icons['speedcam-redlight'] = square(LAYER_COLOR.redLightCamera, TrafficSignalIcon)
  icons['speedcam-p2p'] = square(LAYER_COLOR.p2pCamera, GaugeIcon)
  return icons
}

/** Map image id for a saturation band (an index into DS_BANDS). */
/** Map image id for an NSW RFS incident at its published alert level. */
export function nswFireIcon(level: string) {
  return `nswfire-${level.toLowerCase().replace(/[^a-z]+/g, '-')}`
}

export function signalIcon(band: number) {
  return `signal-${band}`
}

/**
 * Map image id for a bushfire warning level and QFD's published incident type
 * (GroupedType): a campfire for a permitted (planned) burn, a flame for any
 * other fire. Only the type QFD publishes is read; nothing is inferred.
 */
export function fireIcon(level: string, kind: string | null = null) {
  const base = `fire-${level.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return kind?.toUpperCase().includes('PERMITTED BURN') ? `${base}-burn` : base
}

const SVGS = buildIcons()

export function iconUrl(id: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVGS[id] ?? '')}`
}

let loaded: Promise<[string, HTMLImageElement][]> | null = null

function loadAll() {
  loaded ??= Promise.all(
    Object.keys(SVGS).map(
      (id) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image(SIZE * 2, SIZE * 2)
          img.onload = () => resolve([id, img])
          img.onerror = reject
          img.src = iconUrl(id)
        }),
    ),
  )
  return loaded
}

/** Registers every icon on the map's current style (call after each style load). */
export async function ensureIcons(map: MapLibreMap) {
  const imgs = await loadAll()
  for (const [id, img] of imgs) {
    if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 })
  }
}

/** Map image id for a clearance sign showing `metres`, as published. */
export function clearanceIcon(metres: number) {
  return `clearance-${metres}`
}

/** A yellow low clearance sign with the height in black, sized to its text. */
function clearanceSign(metres: number) {
  const label = `${metres}m`
  const w = Math.round(10 + label.length * 6.6)
  const h = 20
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${(h + 2) * 2}" viewBox="0 0 ${w} ${h + 2}">` +
    `<rect x="1" y="1.8" width="${w - 2}" height="${h - 1}" rx="3" fill="rgba(0,0,0,.25)"/>` +
    `<rect x="1" y="1" width="${w - 2}" height="${h - 1}" rx="3" fill="${LAYER_COLOR.clearance}" stroke="#111" stroke-width="1.6"/>` +
    `<text x="${w / 2}" y="14.6" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="700" font-size="11" fill="#111">${label}</text></svg>`
}

export function clearanceIconUrl(metres: number) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clearanceSign(metres))}`
}

const clearanceImages = new Map<number, Promise<HTMLImageElement>>()

/** Registers a sign for each clearance height on the map's current style (call after each style load). */
export async function ensureClearanceIcons(map: MapLibreMap, heights: number[]) {
  const imgs = await Promise.all(
    [...new Set(heights)].map((m) => {
      let p = clearanceImages.get(m)
      if (!p) {
        p = new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = clearanceIconUrl(m)
        })
        clearanceImages.set(m, p)
      }
      return p.then((img) => [m, img] as const)
    }),
  )
  for (const [m, img] of imgs) {
    if (!map.hasImage(clearanceIcon(m))) map.addImage(clearanceIcon(m), img, { pixelRatio: 2 })
  }
}

/** Icon id for a road event marker. */
export function eventIconId(type: string, closureSubtype: string | null | undefined, upcoming: boolean) {
  if (upcoming) return `event-${typeSlug(type)}-future`
  if (closureSubtype) return /through/i.test(closureSubtype) ? 'closure-thru' : 'closure-all'
  return `event-${typeSlug(type)}`
}
