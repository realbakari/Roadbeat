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
import { loadTracks } from '../api/tracks'
import { loadStopFeatures } from '../lib/stopFeatures'
import type { LiveVehicle } from '../api/translink'
import type { Camera, DumpPoint, RestArea, TrafficEvent, TruckRestriction, WazeReport } from '../api/types'
import type { ColorMode } from '../hooks/useColorMode'
import type { Districts } from '../hooks/useTrafficData'
import {
  cameraKey,
  cameraMarkers,
  eventBounds,
  eventMarkers,
  eventShapes,
  placeMarkers,
  truckLines,
  type Bounds,
  type LngLat,
} from '../lib/geo'
import { ensureClearanceIcons, ensureIcons } from '../lib/mapIcons'
import { CrashLayer } from './CrashLayer'
import { CameraThumbs, PinnedCamera } from './map/CameraOverlays'
import { MapCard } from './map/MapCard'
import type { MapCard as MapCardData } from '../lib/mapCard'
import { boundsOf, clearanceFeatures, clearwayFeatures, councilEventFeatures, councilPlaceFeatures, fireFeatures, gaugeFeatures, newsFeatures, newsRoadFeatures, councilCentreFeatures, outageFeatures, airFeatures, setData, signalFeatures, withLabels } from './map/features'
import type { NewsStory } from '../lib/newsStories'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { AirStation } from '../api/airQuality'
import { addLayers, highlightRing, isLine, youAreHere } from './map/layers'
import { RainRadar } from './map/RainRadar'
import type { Basemap, MapLayers } from './map/settings'
import { useAnimatedVehicles } from './map/useAnimatedVehicles'
import { prefersReducedMotion, useSignalAnimation } from './map/useSignalAnimation'

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
  focus: { center: LngLat; zoom?: number; ring?: boolean } | null
  fit: { bounds: Bounds; id: number } | null
  userLocation: LngLat | null
  onSelectEvent: (id: number) => void
  onSelectKey: (hashKey: string) => void
  onCloseCamera: () => void
  /** Opens the locality page named on the pinned camera's card. */
  onOpenLocality: (name: string) => void
  /** Reports the map's centre and zoom after each move. */
  onViewChange?: (view: { center: LngLat; zoom: number }) => void
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
}

const CLICKABLE_PLACES = ['air-quality', 'outages', 'outages-line', 'outages-area', 'council-centres', 'news-pins', 'news-roads', 'council-events', 'clearways-on', 'clearways-off', 'toilets', 'accessible-parking', 'parking-meters', 'bike-stops', 'clearances', 'gauges', 'signals', 'fire-markers', 'fire-areas', 'stops-bus', 'stops-station', 'stops-line', 'vehicles', 'cameras-web', 'cameras-flood', 'places-rest', 'places-dump', 'places-waze', 'trucks-icon', 'trucks-line']
const EVENT_LAYERS = ['event-markers', 'event-lines', 'event-areas']

const staticFiles = new Map<string, Promise<GeoJSON.FeatureCollection | null>>()
/** A GeoJSON file built into public/ (scripts/build-flood-2022.mjs, build-bikeways.mjs), fetched once per visit. */
function loadStatic(path: string) {
  let hit = staticFiles.get(path)
  if (!hit) {
    hit = fetch(path)
      .then((r) => (r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : null))
      .catch(() => {
        staticFiles.delete(path)
        return null
      })
    staticFiles.set(path, hit)
  }
  return hit
}

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
      fitBoundsOptions: { padding: 24 },
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

    for (const layer of [...EVENT_LAYERS, ...CLICKABLE_PLACES]) {
      m.on('click', layer, (e) => {
        const p = read(e.features?.[0])
        if (!p) return
        // A vehicle drawn over a stop takes the tap, so only one of them opens.
        if (layer.startsWith('stops-') && m.queryRenderedFeatures(e.point, { layers: ['vehicles'] }).length) return
        popup.remove()
        if (EVENT_LAYERS.includes(layer)) handlers.current.onSelectEvent(Number(p.id))
        else if (p.key) handlers.current.onSelectKey(String(p.key))
      })
      m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mousemove', layer, (e) => {
        const p = read(e.features?.[0])
        if (p?.label) popup.setLngLat(e.lngLat).setText(String(p.label)).addTo(m)
      })
      m.on('mouseleave', layer, () => {
        m.getCanvas().style.cursor = ''
        popup.remove()
      })
    }
    m.on('mousemove', 'crash-points', (e) => {
      const p = read(e.features?.[0])
      if (p?.label) popup.setLngLat(e.lngLat).setText(String(p.label)).addTo(m)
    })
    m.on('mouseleave', 'crash-points', () => popup.remove())

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
  useEffect(() => {
    if (!ready || !map) return
    setData(map, 'event-shapes', shapes)
    setData(map, 'event-markers', markers)
  }, [map, ready, shapes, markers])
  useEffect(() => {
    if (ready && map) setData(map, 'cameras', cams)
  }, [map, ready, cams])
  useEffect(() => {
    if (ready && map) setData(map, 'places', places)
  }, [map, ready, places])
  useEffect(() => {
    if (ready && map) setData(map, 'trucks', truckData)
  }, [map, ready, truckData])
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
  useEffect(() => {
    if (ready && map) setData(map, 'clearways', clearwayData)
  }, [map, ready, clearwayData])
  const councilPlaces = useMemo(
    () => councilPlaceFeatures({ toilets, bays: accessibleBays, meters: parkingMeters, bikeStops }),
    [toilets, accessibleBays, parkingMeters, bikeStops],
  )
  useEffect(() => {
    if (ready && map) setData(map, 'council-places', councilPlaces)
  }, [map, ready, councilPlaces])
  const newsData = useMemo(() => newsFeatures(newsStories), [newsStories])
  const centreData = useMemo(() => councilCentreFeatures(councilCentres), [councilCentres])
  const outageData = useMemo(() => outageFeatures(outages), [outages])
  const airData = useMemo(() => airFeatures(airStations), [airStations])
  useEffect(() => {
    if (!ready || !map) return
    setData(map, 'council-centres', centreData)
    setData(map, 'outages', outageData)
    setData(map, 'air', airData)
  }, [map, ready, centreData, outageData, airData])
  const newsRoadData = useMemo(() => newsRoadFeatures(newsStories), [newsStories])
  useEffect(() => {
    if (!ready || !map) return
    setData(map, 'news', newsData)
    setData(map, 'news-roads', newsRoadData)
  }, [map, ready, newsData, newsRoadData])
  useEffect(() => {
    if (!ready || !map) return
    map.setFilter('news-selected', ['in', ['get', 'name'], ['literal', selectedStory?.places.map((p) => p.name) ?? []]])
    map.setFilter('news-roads-selected', ['==', ['get', 'story'], selectedStory?.id ?? ''])
  }, [map, ready, selectedStory])
  const councilEventData = useMemo(() => councilEventFeatures(councilEvents), [councilEvents])
  useEffect(() => {
    if (ready && map) setData(map, 'council-events', councilEventData)
  }, [map, ready, councilEventData])
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
  useEffect(() => {
    if (ready && map) setData(map, 'districts', districts)
  }, [map, ready, districts])
  const fireData = useMemo(() => fireFeatures(fires), [fires])
  const gaugeData = useMemo(() => gaugeFeatures(gauges, replayAt ?? now), [gauges, replayAt, now])
  useEffect(() => {
    if (ready && map) setData(map, 'gauges', gaugeData)
  }, [map, ready, gaugeData])
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
  useEffect(() => {
    if (ready && map) setData(map, 'fires', fireData)
  }, [map, ready, fireData])
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
    // The shown line's stations, named, like TransLink's network map.
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

  useEffect(() => {
    if (!map || !selectedEvent) return
    const b = eventBounds(selectedEvent)
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 14, duration: 800 })
  }, [map, selectedEvent])

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
        <PinnedCamera map={map} camera={selectedCamera} now={now} onClose={props.onCloseCamera} onOpenLocality={props.onOpenLocality} />
      )}
      {map && card && !selectedCamera && <MapCard key={card.key} map={map} card={card} onDetails={props.onCardDetails} onClose={props.onCardClose} />}
    </div>
  )
}
