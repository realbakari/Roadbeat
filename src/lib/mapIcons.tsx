import {
  BoatIcon,
  BusIcon,
  TrainIcon,
  TramIcon,
  CameraIcon,
  CarProfileIcon,
  CoffeeIcon,
  TruckIcon,
  VanIcon,
  VideoCameraIcon,
  FlameIcon,
  TrafficSignalIcon,
  ToiletIcon,
  WheelchairIcon,
  type Icon,
} from '@phosphor-icons/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CAMERA_COLOR, EVENT_TYPES } from './eventMeta'
import { FIRE_COLOR, FIRE_LEVELS } from '../api/bushfires'
import { DS_BANDS } from './signals'

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
} as const

export const VEHICLE_COLOR = {
  bus: '#059669',
  train: '#4f46e5',
  tram: '#db2777',
  ferry: '#0284c7',
} as const

function glyph(I: Icon, color: string, size = 16) {
  const svg = renderToStaticMarkup(<I size={size} weight="fill" color={color} />)
  const off = (SIZE - size) / 2
  return svg.replace('<svg ', `<svg x="${off}" y="${off}" `)
}

function wrap(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * 2}" height="${SIZE * 2}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`
}

const shadow = `<circle cx="15" cy="15.8" r="13" fill="rgba(0,0,0,.25)"/>`

function disc(fill: string, I: Icon) {
  return wrap(`${shadow}<circle cx="15" cy="15" r="13" fill="${fill}" stroke="#fff" stroke-width="2"/>${glyph(I, '#fff')}`)
}

/** Outline style for upcoming roadworks/special events, like the official "future" pins. */
function ring(color: string, I: Icon) {
  return wrap(`${shadow}<circle cx="15" cy="15" r="12.5" fill="#fff" stroke="${color}" stroke-width="3"/>${glyph(I, color)}`)
}

function square(fill: string, I: Icon) {
  return wrap(
    `<rect x="2" y="2.8" width="26" height="26" rx="7" fill="rgba(0,0,0,.25)"/><rect x="2" y="2" width="26" height="26" rx="7" fill="${fill}" stroke="#fff" stroke-width="2"/>${glyph(I, '#fff')}`,
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
    icons[`event-${typeSlug(m.type)}`] = disc(m.color, m.icon)
    icons[`event-${typeSlug(m.type)}-future`] = ring(m.color, m.icon)
  }
  icons['closure-all'] = closure('ALL')
  icons['closure-thru'] = closure('THRU')
  icons['camera-webcam'] = disc(CAMERA_COLOR.webcam, VideoCameraIcon)
  icons['camera-floodcam'] = disc(CAMERA_COLOR.floodcam, CameraIcon)
  icons['rest-area'] = square(LAYER_COLOR.restArea, CoffeeIcon)
  icons['rest-area-hv'] = square(LAYER_COLOR.hvRestArea, TruckIcon)
  icons['dump-point'] = square(LAYER_COLOR.dumpPoint, VanIcon)
  icons['waze'] = disc(LAYER_COLOR.waze, CarProfileIcon)
  icons['truck-restriction'] = disc(LAYER_COLOR.truck, TruckIcon)
  icons['toilet'] = square(LAYER_COLOR.toilet, ToiletIcon)
  icons['toilet-accessible'] = square(LAYER_COLOR.toiletAccessible, ToiletIcon)
  icons['accessible-parking'] = square(LAYER_COLOR.accessibleParking, WheelchairIcon)
  icons['vehicle-bus'] = disc(VEHICLE_COLOR.bus, BusIcon)
  icons['vehicle-train'] = disc(VEHICLE_COLOR.train, TrainIcon)
  icons['vehicle-tram'] = disc(VEHICLE_COLOR.tram, TramIcon)
  icons['vehicle-ferry'] = disc(VEHICLE_COLOR.ferry, BoatIcon)
  for (const level of FIRE_LEVELS) icons[fireIcon(level)] = disc(FIRE_COLOR[level], FlameIcon)
  DS_BANDS.forEach(([, color], band) => (icons[signalIcon(band)] = disc(color, TrafficSignalIcon)))
  return icons
}

/** Map image id for a saturation band (an index into DS_BANDS). */
export function signalIcon(band: number) {
  return `signal-${band}`
}

/** Map image id for a bushfire warning level. */
export function fireIcon(level: string) {
  return `fire-${level.toLowerCase().replace(/[^a-z]+/g, '-')}`
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
