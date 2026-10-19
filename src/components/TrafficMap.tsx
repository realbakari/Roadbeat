import * as maplibregl from 'maplibre-gl'
import type { MapGeoJSONFeature } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CrashFilter } from '../api/crashes'
import type { Gauge } from '../api/bccGauges'
import type { SignalSite, SignalVolumes } from '../api/bccSignals'
import type { Clearance } from '../api/clearances'
import type { AccessibleBay, BikeStop, Clearway, ParkingMeter, Toilet } from '../api/bccPlaces'
import type { CouncilEvent } from '../api/bccDashboard'
import type { FireWarning } from '../api/bushfires'
import { warningFeatures, type QldWarning } from '../api/qldWarnings'
import type { SatelliteTiles } from '../lib/satelliteImage'
import { loadTracks } from '../api/tracks'
import { loadStopFeatures } from '../lib/stopFeatures'
import type { LiveVehicle } from '../api/transitTypes'
import type { Camera, Districts, DumpPoint, RestArea, TrafficEvent, TruckRestriction, WazeReport } from '../api/types'
import type { ColorMode } from '../hooks/useColorMode'
import { loadStatic } from '../api/staticGeo'
import {
  cameraKey,
  cameraMarkers,
  eventMarkers,
  eventShapes,
  placeMarkers,
  truckLines,
  type Bounds,
  type LngLat,
  type MapView,
} from '../lib/geo'
import { ensureClearanceIcons, ensureIcons } from '../lib/mapIcons'
import { pickTap, pickTop, tapBox, tapTolerance } from '../lib/mapPick'
import { CrashLayer } from './CrashLayer'
import { CameraThumbs, PinnedCamera } from './map/CameraOverlays'
import type { CrossingStatus } from '../lib/crossings'
import { MapCard } from './map/MapCard'
import type { MapCard as MapCardData } from '../lib/mapCard'
import { boundsOf, clearanceFeatures, clearwayFeatures, councilEventFeatures, councilPlaceFeatures, fireFeatures, gaugeFeatures, newsFeatures, newsRoadFeatures, councilCentreFeatures, outageFeatures, airFeatures, hotspotFeatures, setData, signalFeatures, withLabels } from './map/features'
import type { NewsStory } from '../lib/newsStories'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { AirStation } from '../api/airQuality'
import type { Hotspot } from '../api/hotspots'
import { SatelliteImagery } from './map/SatelliteImagery'
import { MapTools } from './map/MapTools'
import { cycloneFeatures, nswFireFeatures, nswHazardFeatures, pastCycloneFeatures } from './map/hazardLayers'
import type { NswFire } from '../api/nswFires'
import type { NswHazard } from '../api/nswHazards'
import type { Cyclone } from '../api/jtwc'
import type { PastCyclone } from '../api/pastCyclones'
import type { SpeedCamera } from '../api/speedCameras'
import { speedCameraFeatures } from './map/speedCameraLayers'
import { fuelFeatures, PINS } from './map/fuelLayers'
import type { FuelStation } from '../api/fuelStations'
import { addLayers, highlightRing, isLine, youAreHere } from './map/layers'
import { RainRadar } from './map/RainRadar'
import type { Basemap, MapLayers } from './map/settings'
import { useAnimatedVehicles } from './map/useAnimatedVehicles'
import { useSourceData } from './map/useSourceData'
import { useFitEvent } from './map/useFitEvent'
import { prefersReducedMotion, useSignalAnimation } from './map/useSignalAnimation'
import { brandedName, byBrand, cheapestIn, useFuelBrands, useFuelLabel, type ViewBounds } from '../lib/fuelBrands'
import { centsText } from '../api/fuelStations'

// Vite pre-bundles maplibre-gl away from its sibling worker file, so point at it explicitly.
maplibregl.setWorkerUrl(workerUrl)

const STYLES: Record<ColorMode, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

const BASEMAP_STYLE: Record<Exclude<Basemap, 'standard'>, string> = {
  detailed: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  night: 'https://tiles.openfreemap.org/styles/fiord',
}
const styleUrl = (basemap: Basemap, mode: ColorMode) => (basemap === 'standard' ? STYLES[mode] : BASEMAP_STYLE[basemap])
/** Tilt used for 3D buildings. */
const TILT = 50

const QLD_BOUNDS: [LngLat, LngLat] = [
  [137.9, -29.2],
  [153.6, -10.6],
]
/**
 * How far the map can be panned or zoomed out: Australia, New Guinea and the
 * Coral Sea, where the cyclone tracks run. Without it, panning south or
 * zooming out ended on a screen of Antarctic ice or empty ocean.
 */
const MAX_BOUNDS: [LngLat, LngLat] = [
  [100, -50],
  [185, 5],
]

interface Props {
  mode: ColorMode
  basemap: Basemap
  now: number
  events: TrafficEvent[]
  cameras: Camera[]
  restAreas: RestArea[]
  dumpPoints: DumpPoint[]
  waze: WazeReport[]
  trucks: TruckRestriction[]
  districts: Districts
  district: string
  layers: MapLayers
  crashFilter: CrashFilter
  vehicles: LiveVehicle[]
  /** Queensland Fire Department warnings and incidents. */
  fires: FireWarning[]
  /** Queensland's severe weather, flood and cyclone warnings. */
  warnings: QldWarning[]
  gauges: Gauge[]
  /** The replayed time while the timeline is scrubbed, or null when live: gauge labels are read as of this time. */
  replayAt: number | null
  signalSites: SignalSite[]
  signalVolumes: SignalVolumes | null
  clearances: Clearance[]
  clearways: Clearway[]
  toilets: Toilet[]
  accessibleBays: AccessibleBay[]
  parkingMeters: ParkingMeter[]
  bikeStops: BikeStop[]
  councilEvents: CouncilEvent[]
  /** News monitor stories that name a place. */
  newsStories: NewsStory[]
  /** Centres listed on council disaster dashboards. */
  councilCentres: CouncilCentre[]
  /** Power outages and council notices from the council disaster dashboards. */
  outages: Outage[]
  airStations: AirStation[]
  /** Geoscience Australia's satellite hotspots in the last 24 hours. */
  hotspots: Hotspot[]
  /** The one satellite image to draw while the base is Satellite, or null for the street map alone. */
  satelliteImage: SatelliteTiles | null
  /** One line per shown source with its data time, for a saved image's footer. */
  imageSources: string[]
  /** NSW RFS incidents near the Queensland border. */
  nswFires: NswFire[]
  /** Transport for NSW road hazards near the border. */
  nswHazards: NswHazard[]
  /** JTWC's current cyclones near Australia. */
  cyclones: Cyclone[]
  /** Past cyclone tracks near Queensland. */
  pastCyclones: PastCyclone[]
  speedCameras: SpeedCamera[]
  fuelStations: FuelStation[]
  /** The open news story: its places are ringed and its roads drawn wider. */
  selectedStory: NewsStory | null
  selectedVehicleId: string | null
  /** A short card for the selected item, shown on the map while the side panel is hidden. */
  card: MapCardData | null
  onCardDetails: () => void
  onCardClose: () => void
  /** Route codes whose train, tram or ferry track to highlight (a line shown on the map, or the selected vehicle's route). */
  trackCodes: string[] | null
  /** Keep the map centred on the selected vehicle as it moves. */
  followVehicle: boolean
  selectedEvent: TrafficEvent | null
  selectedCamera: Camera | null
  /** The selected flood camera's crossing, from all road events (not the list's filters), or null. */
  cameraCrossing: CrossingStatus | null
  focus: { center: LngLat; zoom?: number; ring?: boolean } | null
  fit: { bounds: Bounds; id: number } | null
  userLocation: LngLat | null
  /** Finds the user and flies the map there, from the map's own locate button. */
  onLocate: () => void
  locating: boolean
  onSelectEvent: (id: number) => void
  onSelectKey: (hashKey: string) => void
  onCloseCamera: () => void
  /** Opens the locality page named on the pinned camera's card. */
  onOpenLocality: (name: string) => void
  /** Reports the map's centre and zoom after each move. */
  onViewChange?: (view: MapView) => void
}

// Which map layers each toggle controls.
const TOGGLES: Record<keyof MapLayers, string[]> = {
  webcams: ['cameras-web'],
  floodcams: ['cameras-flood'],
  restAreas: ['places-rest'],
  dumpPoints: ['places-dump'],
  trucks: ['trucks-line', 'trucks-icon'],
  waze: ['places-waze'],
  radar: [],
  crashes: ['crash-heat', 'crash-points'],
  vehicles: ['vehicles', 'vehicles-selected', 'tracks-network', 'stops-bus', 'stops-station', 'stops-station-label'],
  buildings3d: ['qldt-buildings-3d'],
  fires: ['fire-areas', 'fire-area-lines', 'fire-markers'],
  warnings: ['warning-areas', 'warning-area-lines', 'warning-markers'],
  gauges: ['gauges', 'gauges-label'],
  signals: ['signals', 'signals-label', 'signals-halo', 'signals-ring'],
  clearances: ['clearances'],
  clearways: ['clearways-on', 'clearways-off'],
  toilets: ['toilets'],
  accessibleParking: ['accessible-parking'],
  flood2022: ['flood-2022-fill', 'flood-2022-line'],
  parkingMeters: ['parking-meters'],
  cycling: ['bikeways', 'bike-stops'],
  councilEvents: ['council-events'],
  news: ['news-pins', 'news-count', 'news-selected', 'news-roads', 'news-roads-selected'],
  councilCentres: ['council-centres'],
  outages: ['outages', 'outages-line', 'outages-area'],
  airQuality: ['air-quality'],
  hotspots: ['hotspots'],
  nswFires: ['nsw-fires'],
  nswHazards: ['nsw-hazard-lines', 'nsw-hazards'],
  cyclones: ['cyclone-track', 'cyclone-points'],
  pastCyclones: ['past-cyclones'],
  speedCameras: ['speed-cameras'],
  fuel: ['fuel', 'fuel-prices'],
}

const CLICKABLE_PLACES = ['fuel', 'speed-cameras', 'air-quality', 'hotspots', 'nsw-fires', 'nsw-hazards', 'nsw-hazard-lines', 'cyclone-points', 'cyclone-track', 'past-cyclones', 'outages', 'outages-line', 'outages-area', 'council-centres', 'news-pins', 'news-roads', 'council-events', 'clearways-on', 'clearways-off', 'toilets', 'accessible-parking', 'parking-meters', 'bike-stops', 'clearances', 'gauges', 'signals', 'fire-markers', 'fire-areas', 'warning-markers', 'warning-areas', 'stops-bus', 'stops-station', 'stops-line', 'vehicles', 'cameras-web', 'cameras-flood', 'places-rest', 'places-dump', 'places-waze', 'trucks-icon', 'trucks-line']
const EVENT_LAYERS = ['event-markers', 'event-lines', 'event-areas']
/** What the crosshair reads under the centre: everything a tap can open. */
const READABLE = [...EVENT_LAYERS, ...CLICKABLE_PLACES]

export function TrafficMap(props: Props) {
  const {
    mode,
    basemap,
    now,
    events,
    cameras,
    restAreas,
    dumpPoints,
    waze,
    trucks,
    districts,
    district,
    layers,
    crashFilter,
    vehicles,
    fires,
    warnings,
    gauges,
    replayAt,
    signalSites,
    signalVolumes,
    clearances,
    clearways,
    toilets,
    accessibleBays,
    parkingMeters,
    bikeStops,
    councilEvents,
    newsStories,
    councilCentres,
    outages,
    airStations,
    hotspots,
    satelliteImage,
    imageSources,
    nswFires,
    nswHazards,
    cyclones,
    pastCyclones,
    speedCameras,
    fuelStations,
    selectedStory,
    selectedVehicleId,
    card,
    trackCodes,
    followVehicle,
    selectedEvent,
    selectedCamera,
    focus,
    fit,
    userLocation,
    onLocate,
    locating,
  } = props
  const container = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(0) // bumps after each style load so data effects re-run

  const shapes = useMemo(() => withLabels(eventShapes(events), events), [events])
  const markers = useMemo(() => withLabels(eventMarkers(events), events), [events])
  const cams = useMemo(() => cameraMarkers(cameras), [cameras])
  const places = useMemo(() => placeMarkers(restAreas, dumpPoints, waze), [restAreas, dumpPoints, waze])
  const truckData = useMemo(() => truckLines(trucks), [trucks])
  const selectedId = selectedEvent?.properties.id ?? -1

  // Map event listeners are registered once; they read the latest props through this ref.
  const handlers = useRef(props)
  useLayoutEffect(() => {
    handlers.current = props
  })
  // The style the map was created with or last switched to.
  const appliedStyle = useRef(styleUrl(basemap, mode))

  useEffect(() => {
    if (!container.current) return
    const m = new maplibregl.Map({
      container: container.current,
      style: appliedStyle.current,
      bounds: QLD_BOUNDS,
      maxBounds: MAX_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      // Past 19 the base map's roads are stretched from zoom 14 tiles, and the few metres
      // between QLDTraffic's surveyed lines and OpenStreetMap's fill the screen.
      maxZoom: 19,
      attributionControl: { compact: true },
      // A north-up, flat map keeps the rain radar overlay aligned.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    m.touchZoomRotate.disableRotation()
    if (import.meta.env.DEV) (window as unknown as { __map: maplibregl.Map }).__map = m
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16, maxWidth: '260px' })

    const reportView = () => {
      const c = m.getCenter()
      handlers.current.onViewChange?.({ center: [c.lng, c.lat], zoom: m.getZoom() })
    }
    m.on('moveend', reportView)
    m.on('load', reportView)

    m.on('style.load', async () => {
      await ensureIcons(m)
      addLayers(m, handlers.current.mode)
      setReady((n) => n + 1)
    })

    const read = (f: MapGeoJSONFeature | undefined) => f?.properties as Record<string, unknown> | undefined

    // One handler for the whole map, so a tap opens one feature rather than one per layer under it.
    const under = (point: maplibregl.PointLike | [maplibregl.PointLike, maplibregl.PointLike], extra: string[] = []) => {
      const layers = [...EVENT_LAYERS, ...CLICKABLE_PLACES, ...extra].filter((l) => m.getLayer(l))
      return layers.length ? m.queryRenderedFeatures(point, { layers }) : []
    }
    // A tap that lands just off a small dot still opens it: the exact point first, then a box around it.
    const coarse = window.matchMedia('(pointer: coarse)')
    m.on('click', (e) => {
      const t = pickTap(under(e.point), EVENT_LAYERS) ?? pickTap(under(tapBox(e.point.x, e.point.y, tapTolerance(coarse.matches))), EVENT_LAYERS)
      if (!t) return
      popup.remove()
      if (t.kind === 'event') handlers.current.onSelectEvent(t.id)
      else handlers.current.onSelectKey(t.key)
    })
    m.on('mousemove', (e) => {
      const fs = under(e.point, ['crash-points'])
      m.getCanvas().style.cursor = fs.some((f) => f.layer.id !== 'crash-points') ? 'pointer' : ''
      const label = read(pickTop(fs) ?? undefined)?.label
      if (label) popup.setLngLat(e.lngLat).setText(String(label)).addTo(m)
      else popup.remove()
    })

    const ro = new ResizeObserver(() => m.resize())
    ro.observe(container.current)
    setMap(m)

    return () => {
      ro.disconnect()
      m.remove()
      setMap(null)
    }
  }, [])

  // Theme and base map changes swap the style; 'style.load' then re-adds our layers.
  useEffect(() => {
    const url = styleUrl(basemap, mode)
    if (!map || appliedStyle.current === url) return
    appliedStyle.current = url
    map.setStyle(url)
  }, [map, basemap, mode])

  // 3D buildings: tilt the map to show them, except while the rain radar (a flat image over the map) is on.
  const tilted = layers.buildings3d && !layers.radar
  useEffect(() => {
    if (!map) return
    map.easeTo({ pitch: tilted ? TILT : 0, bearing: 0, duration: 600 })
  }, [map, tilted])

  // Push data into sources (also re-runs after every style reload via `ready`).
  useSourceData(map, ready, 'event-shapes', shapes)
  useSourceData(map, ready, 'event-markers', markers)
  useSourceData(map, ready, 'cameras', cams)
  useSourceData(map, ready, 'places', places)
  useSourceData(map, ready, 'trucks', truckData)
  // Each height's sign is drawn once its image is registered on the current style.
  useEffect(() => {
    if (!ready || !map) return
    let live = true
    ensureClearanceIcons(map, clearances.map((c) => c.metres)).then(() => live && setData(map, 'clearances', clearanceFeatures(clearances)))
    return () => {
      live = false
    }
  }, [map, ready, clearances])
  // Clearways recolour as their signed times start and end; `now` ticks every 30 s.
  const clearwayData = useMemo(() => clearwayFeatures(clearways, now), [clearways, now])
  useSourceData(map, ready, 'clearways', clearwayData)
  const councilPlaces = useMemo(
    () => councilPlaceFeatures({ toilets, bays: accessibleBays, meters: parkingMeters, bikeStops }),
    [toilets, accessibleBays, parkingMeters, bikeStops],
  )
  useSourceData(map, ready, 'council-places', councilPlaces)
  const newsData = useMemo(() => newsFeatures(newsStories), [newsStories])
  const centreData = useMemo(() => councilCentreFeatures(councilCentres), [councilCentres])
  const outageData = useMemo(() => outageFeatures(outages), [outages])
  const airData = useMemo(() => airFeatures(airStations), [airStations])
  // Recoloured once a minute as detections age, not on every render.
  const minute = Math.floor(now / 60_000)
  const hotspotData = useMemo(() => hotspotFeatures(hotspots, minute * 60_000), [hotspots, minute])
  useSourceData(map, ready, 'hotspots', hotspotData)
  const nswFireData = useMemo(() => nswFireFeatures(nswFires), [nswFires])
  const cycloneData = useMemo(() => cycloneFeatures(cyclones), [cyclones])
  const pastCycloneData = useMemo(() => pastCycloneFeatures(pastCyclones), [pastCyclones])
  useSourceData(map, ready, 'nsw-fires', nswFireData)
  const nswHazardData = useMemo(() => nswHazardFeatures(nswHazards), [nswHazards])
  useSourceData(map, ready, 'nsw-hazards', nswHazardData)
  useSourceData(map, ready, 'cyclones', cycloneData)
  useSourceData(map, ready, 'past-cyclones', pastCycloneData)
  const speedCameraData = useMemo(() => speedCameraFeatures(speedCameras), [speedCameras])
  useSourceData(map, ready, 'speed-cameras', speedCameraData)
  const fuelBrands = useFuelBrands()
  const fuelLabel = useFuelLabel()
  // The view's bounds after each move, for the cheapest price in view; only kept while the fuel layer is on.
  const [fuelView, setFuelView] = useState<ViewBounds | null>(null)
  useEffect(() => {
    if (!map || !layers.fuel) return
    const read = () => {
      const b = map.getBounds()
      setFuelView([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]])
    }
    read()
    map.on('moveend', read)
    return () => {
      map.off('moveend', read)
    }
  }, [map, layers.fuel])
  const shownFuel = useMemo(() => byBrand(fuelStations, fuelBrands), [fuelStations, fuelBrands])
  // Freshness is judged by the day, so the pins aren't rebuilt each time the clock ticks.
  const today = Math.floor(now / 86_400_000) * 86_400_000
  const cheapest = useMemo(() => (layers.fuel ? cheapestIn(shownFuel, fuelLabel, fuelView, today) : null), [layers.fuel, shownFuel, fuelLabel, fuelView, today])
  const fuelData = useMemo(() => fuelFeatures(shownFuel, fuelLabel, cheapest?.ids, today), [shownFuel, fuelLabel, cheapest, today])
  useSourceData(map, ready, 'fuel', fuelData)
  useSourceData(map, ready, 'council-centres', centreData)
  useSourceData(map, ready, 'outages', outageData)
  useSourceData(map, ready, 'air', airData)
  const newsRoadData = useMemo(() => newsRoadFeatures(newsStories), [newsStories])
  useSourceData(map, ready, 'news', newsData)
  useSourceData(map, ready, 'news-roads', newsRoadData)
  useEffect(() => {
    if (!ready || !map) return
    map.setFilter('news-selected', ['in', ['get', 'name'], ['literal', selectedStory?.places.map((p) => p.name) ?? []]])
    map.setFilter('news-roads-selected', ['==', ['get', 'story'], selectedStory?.id ?? ''])
  }, [map, ready, selectedStory])
  const councilEventData = useMemo(() => councilEventFeatures(councilEvents), [councilEvents])
  useSourceData(map, ready, 'council-events', councilEventData)
  // The February 2022 flood extent (0.5 MB) and the bikeway network (0.25 MB) load the first time their layer is turned on.
  const showFlood = layers.flood2022
  useEffect(() => {
    if (!ready || !map || !showFlood) return
    let live = true
    loadStatic('/flood-2022.json').then((data) => live && data && setData(map, 'flood-2022', data))
    return () => {
      live = false
    }
  }, [map, ready, showFlood])
  const showCycling = layers.cycling
  useEffect(() => {
    if (!ready || !map || !showCycling) return
    let live = true
    loadStatic('/bikeways.json').then((data) => live && data && setData(map, 'bikeways', data))
    return () => {
      live = false
    }
  }, [map, ready, showCycling])
  useSourceData(map, ready, 'districts', districts)
  const fireData = useMemo(() => fireFeatures(fires), [fires])
  const gaugeData = useMemo(() => gaugeFeatures(gauges, replayAt ?? now), [gauges, replayAt, now])
  useSourceData(map, ready, 'gauges', gaugeData)
  // Each new batch of volumes is compared with the last one, so changed sites can ring.
  const previousVolumes = useRef<SignalVolumes | null>(null)
  const [signalBatch, setSignalBatch] = useState(0)
  useEffect(() => {
    if (!ready || !map) return
    const previous = previousVolumes.current
    const data = signalFeatures(signalSites, signalVolumes ?? new Map(), previous === signalVolumes ? null : previous)
    setData(map, 'signals', data)
    // The council publishes about every 5 minutes, so many polls bring nothing new: ring only when something changed.
    if (data.features.some((f) => f.properties?.changed)) setSignalBatch((n) => n + 1)
    previousVolumes.current = signalVolumes
  }, [map, ready, signalSites, signalVolumes])
  useSignalAnimation(map, ready, layers.signals && !prefersReducedMotion(), signalBatch)
  useSourceData(map, ready, 'fires', fireData)
  const warningData = useMemo(() => warningFeatures(warnings), [warnings])
  useSourceData(map, ready, 'qld-warnings', warningData)
  useAnimatedVehicles(map, ready, vehicles, followVehicle ? selectedVehicleId : null)
  useEffect(() => {
    if (ready && map) map.setFilter('vehicles-selected', ['==', ['get', 'key'], `vehicle/${selectedVehicleId ?? ''}`])
  }, [map, ready, selectedVehicleId])

  // Tracks load with the live vehicles layer or when a line's track is shown.
  const wantTracks = layers.vehicles || !!trackCodes?.length
  useEffect(() => {
    if (!ready || !map || !wantTracks) return
    let live = true
    loadTracks().then((t) => live && t && setData(map, 'tracks', t))
    loadStopFeatures().then((f) => live && setData(map, 'stops', f))
    return () => {
      live = false
    }
  }, [map, ready, wantTracks])
  const trackKey = trackCodes?.join(',') ?? ''
  useEffect(() => {
    if (!ready || !map) return
    const codes = trackKey ? trackKey.split(',') : []
    for (const id of ['tracks-line-casing', 'tracks-line']) {
      map.setFilter(id, ['all', ['==', ['get', 'region'], 'SEQ'], ['in', ['get', 'code'], ['literal', codes]]])
      map.setLayoutProperty(id, 'visibility', codes.length ? 'visible' : 'none')
    }
    // The shown line's stations, named, like Translink's network map.
    const onLine = ['any', ...codes.map((c) => ['in', `|${c}|`, ['get', 'codes']])]
    for (const id of ['stops-line', 'stops-line-label']) {
      map.setFilter(id, codes.length ? (onLine as never) : ['==', ['get', 'key'], ''])
      map.setLayoutProperty(id, 'visibility', codes.length ? 'visible' : 'none')
    }
  }, [map, ready, trackKey])

  useEffect(() => {
    if (!ready || !map) return
    for (const [key, ids] of Object.entries(TOGGLES)) {
      for (const id of ids) map.setLayoutProperty(id, 'visibility', layers[key as keyof MapLayers] ? 'visible' : 'none')
    }
  }, [map, ready, layers])

  useEffect(() => {
    if (!ready || !map) return
    map.setFilter('event-markers-selected', ['==', ['get', 'id'], selectedId])
    map.setFilter('event-lines-selected', ['all', ['==', ['get', 'id'], selectedId], isLine])
  }, [map, ready, selectedId])

  useEffect(() => {
    if (!ready || !map) return
    map.setFilter('district-line', ['==', ['get', 'district'], district])
    map.setFilter('district-fill', ['==', ['get', 'district'], district])
    const f = districts.features.find((d) => d.properties.district === district)
    if (f && !handlers.current.selectedEvent) {
      const b = boundsOf(f.geometry)
      if (b) map.fitBounds(b, { padding: 40, duration: 800 })
    }
  }, [map, ready, district, districts])

  useFitEvent(map, selectedEvent)

  useEffect(() => {
    if (!map || !focus) return
    map.flyTo({ center: focus.center, zoom: Math.max(map.getZoom(), focus.zoom ?? 13), duration: 800 })
    if (focus.ring === false) return
    const ring = new maplibregl.Marker({ element: highlightRing() }).setLngLat(focus.center).addTo(map)
    return () => {
      ring.remove()
    }
  }, [map, focus])

  useEffect(() => {
    if (map && fit) map.fitBounds(fit.bounds, { padding: 60, maxZoom: 13, duration: 800 })
  }, [map, fit])

  useEffect(() => {
    if (!map || !userLocation) return
    const marker = new maplibregl.Marker({ element: youAreHere() }).setLngLat(userLocation).addTo(map)
    map.flyTo({ center: userLocation, zoom: 10, duration: 800 })
    return () => {
      marker.remove()
    }
  }, [map, userLocation])

  const visibleCameras = useMemo(
    () => cameras.filter((c) => (c.kind === 'webcam' ? layers.webcams : layers.floodcams)),
    [cameras, layers.webcams, layers.floodcams],
  )

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" aria-label="Traffic map" role="region" />
      <RainRadar map={map} enabled={layers.radar} ready={ready} />
      <MapTools map={map} layers={layers} sources={imageSources} readable={READABLE} onLocate={onLocate} locating={locating} located={userLocation != null} />
      <SatelliteImagery map={map} ready={ready} image={satelliteImage} />
      {map && <CrashLayer map={map} ready={ready} enabled={layers.crashes} filter={crashFilter} />}
      {map && (
        <CameraThumbs
          map={map}
          cameras={visibleCameras}
          selectedKey={selectedCamera ? cameraKey(selectedCamera) : null}
          now={now}
          onSelect={(k) => props.onSelectKey(`camera/${k}`)}
        />
      )}
      {map && selectedCamera && (
        <PinnedCamera map={map} camera={selectedCamera} now={now} onClose={props.onCloseCamera} onOpenLocality={props.onOpenLocality} crossing={props.cameraCrossing} onOpenEvent={props.onSelectEvent} />
      )}
      {map && card && !selectedCamera && <MapCard key={card.key} map={map} card={card} onDetails={props.onCardDetails} onClose={props.onCardClose} />}
      {/* The cheapest in view, in words as well as the green tag; opens the station. */}
      {cheapest && (
        <button
          type="button"
          onClick={() => props.onSelectKey(`place/fuel/${encodeURIComponent(cheapest.stations[0].id)}`)}
          className="absolute top-14 left-1/2 z-10 flex max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-kumo-base px-3 py-1.5 text-sm shadow-md ring ring-kumo-line hover:bg-kumo-tint"
        >
          <span className="shrink-0 rounded-md px-1.5 font-semibold text-white tabular-nums" style={{ backgroundColor: PINS['fuel-pin-cheap'][mode].fill, boxShadow: `0 0 0 2px ${PINS['fuel-pin-cheap'][mode].rim}` }}>{centsText(cheapest.cents)}</span>
          <span className="min-w-0 truncate">
            Cheapest {fuelLabel} in view · {brandedName(cheapest.stations[0])}
            {cheapest.stations.length > 1 && ` and ${cheapest.stations.length - 1} more`}
          </span>
        </button>
      )}
    </div>
  )
}
