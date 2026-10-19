import { Banner, Button, Tabs, TooltipProvider } from '@cloudflare/kumo'
import {
  ArrowsInSimpleIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  SidebarSimpleIcon,
  ListIcon,
  MapTrifoldIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CRASH_FILTER, type CrashFilter } from './api/crashes'
import { loadTracks, trackBounds } from './api/tracks'
import { allRouteCodes } from './api/translink'
import type { VehicleMode } from './api/transitTypes'
import { AlertSettingsDialog } from './components/AlertSettingsDialog'
import { FeedbackDialog } from './components/FeedbackDialog'
import { AppHeader } from './components/AppHeader'
import { commuteWindow } from './lib/commute'
import { useCommute } from './lib/commuteStore'
import { useAlertSettings, useNotifications } from './hooks/useNotifications'
import { MapLayersPanel } from './components/MapLayersPanel'
import { SidePanel, type Panel } from './components/SidePanel'
import { ReplayBanner, Timeline } from './components/Timeline'
import { TrafficMap } from './components/TrafficMap'
import { DEFAULT_LAYERS, type Basemap, type MapLayers } from './components/map/settings'
import { useColorMode } from './hooks/useColorMode'
import { useVisitors } from './hooks/useVisitors'
import { SkipLinks } from './components/SkipLinks'
import { pageTitle } from './lib/pageTitle'
import { eventTitle } from './lib/eventText'
import { useMediaQuery } from './hooks/useMediaQuery'
import { mapCardFor } from './lib/mapCard'
import { isUnplaced } from './lib/outages'
import { usePanelLayout, VIEW_IDS } from './hooks/usePanelLayout'
import { useEventHistory, useTimeline } from './hooks/useTimeline'
import { useLocality } from './hooks/useLocality'
import { useHashSelection, useSelectedPlace, type MapFocus } from './hooks/useSelection'
import { useClearances, useReferenceData, useTrafficData } from './hooks/useRoadFeeds'
import { useCouncilPlaces, useGauges, useRoadOccupancies, useSignals } from './hooks/useCouncilFeeds'
import { useLiveVehicles, useTransitAlerts } from './hooks/useTransitFeeds'
import { useNews } from './hooks/useNews'
import { useNow } from './hooks/useNow'
import { useHotspots } from './hooks/useSatellite'
import { useSatelliteImagery } from './hooks/useSatelliteImagery'
import { useQldWarnings } from './hooks/useQldWarnings'
import { MajorStrip } from './components/MajorStrip'
import { majorIncidents } from './lib/majorIncidents'
import { feedStatus } from './lib/feedAge'
import { isGibsLive, jmaProduct, SATELLITE_SOURCES, satelliteTiles, type SatelliteSource } from './lib/satelliteImage'
import { frameAt, recentFrames } from './lib/frames'
import { brisbaneDate } from './lib/aest'
import { layerCounts as countLayers, layerTimes } from './lib/layerInfo'
import { imageSources as sourceLines, satelliteImageTime } from './lib/mapImage'
import { SatelliteTimeline } from './components/map/SatelliteTimeline'
import { parseBase, parseBasemap, parseSatelliteSource, type MapBase } from './lib/mapBase'
import { useStoredChoice } from './hooks/useStoredChoice'
import { searchWithView, viewFromSearch } from './lib/viewUrl'
import { satelliteSuggestion } from './lib/satelliteSuggestion'
import { useSatelliteDismissals } from './hooks/useSatelliteDismissals'
import { useFocusOnce } from './hooks/useFocusOnce'
import { SatelliteSuggestion } from './components/map/SatelliteSuggestion'
import { useAirQuality, useBushfires, useCyclones, useFireBans, useNswFires, usePastCyclones, useSpeedCameras, useFuelStations } from './hooks/useHazardFeeds'
import { asCameras } from './lib/cameras'
import { roadBounds } from './lib/newsRoads'
import { DEFAULT_STORY_FILTER, filterStories, groupStories, storyBounds, type StoryFilter } from './lib/newsStories'
import { applyFilters, DEFAULT_FILTERS, districtsOf, type EventFilters } from './lib/filters'
import { asTrafficEvent, replayAt } from './lib/timeline'
import { cameraKey, pointBounds, type Bounds, type LngLat, type MapView } from './lib/geo'
import { feedNotice } from './lib/feedNotice'
import type { LocalitySources } from './lib/locality'
import type { LoadedSources } from './components/GlobalSearch'

export function App() {
  const { mode, toggle } = useColorMode()
  const { events, cameras: tmrCameras, waze, loading, refreshing, error, fetchedAt, refresh } = useTrafficData()
  // Bushfire warnings are always fetched: they're on the map and list by default and feed notifications.
  const { fires, error: fireError, fetchedAt: firesAt } = useBushfires(true)
  const fireNotice = feedNotice('Bushfire warnings', fires != null, fireError, firesAt)
  // Always read, like the bushfires: the list, the strip under the header and alerts all show them.
  const qw = useQldWarnings()
  const warningNotice = feedNotice('Queensland warnings', qw.warnings != null, qw.error, qw.fetchedAt)
  const firstLoad = loading && fetchedAt == null
  const ref = useReferenceData()
  const now = useNow()

  const [panelChoice, setPanel] = useState<Panel>('events')
  const [sel, go] = useHashSelection()
  const visitors = useVisitors()
  // #news and #news/<story> open the News tab whichever tab was last chosen.
  const panel: Panel = sel.news != null ? 'news' : panelChoice
  const occupancies = useRoadOccupancies(panel === 'events')
  const { mobileView, panelMode, setPanelMode, revealMap, revealList } = usePanelLayout()
  const [mapView, setMapView] = useState<MapView | null>(null)
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS)
  // A link to the News tab or a story (#news/…) opens with the news pins on.
  // A shared link's base, image and layers (?base=satellite&layers=…) open that view; see src/lib/viewUrl.ts.
  const [linked] = useState(() => viewFromSearch(location.search))
  const [layers, setLayers] = useState<MapLayers>(() => linked.layers ?? (location.hash.startsWith('#news') ? { ...DEFAULT_LAYERS, news: true } : DEFAULT_LAYERS))
  // The street map's style is remembered in this browser; 3D buildings travel in the URL with the other layers.
  const [basemap, setBasemap] = useStoredChoice<Basemap>('qldt-basemap', parseBasemap, 'standard')
  // The base (street map or satellite) and the satellite image chosen are remembered too.
  const [base, setBase] = useStoredChoice<MapBase>('qldt-base', parseBase, 'map', linked.base)
  const [satelliteSource, setSatelliteSource] = useStoredChoice<SatelliteSource>('qldt-satellite', parseSatelliteSource, 'infrared', linked.image)
  useEffect(() => {
    const search = searchWithView(location.search, { base, image: satelliteSource, layers })
    if (search !== location.search) history.replaceState(history.state, '', location.pathname + search + location.hash)
  }, [base, satelliteSource, layers])
  const [crashFilter, setCrashFilter] = useState<CrashFilter>(DEFAULT_CRASH_FILTER)
  const [userLocation, setUserLocation] = useState<LngLat | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [alertSettings, setAlertSettings] = useAlertSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [vehicleModes, setVehicleModes] = useState<VehicleMode[]>(['train', 'bus', 'tram', 'ferry'])
  const [vehicleFilter, setVehicleFilter] = useState<{ title: string; match: (code: string) => boolean } | null>(null)
  const [followVehicle, setFollowVehicle] = useState(false)
  const [fit, setFit] = useState<{ bounds: Bounds; id: number } | null>(null)
  // The 48-hour timeline. While a time is chosen, road events, news pins and gauge labels show what was published by then; every other layer stays live.
  const [timelineOpen, setTimelineOpen] = useState(false)
  const timeline = useTimeline()
  const replayTime = timelineOpen ? timeline.at : null
  const eventHistory = useEventHistory(timelineOpen)

  const transitOpen = panel === 'transit' || !!sel.transit
  // During the commute window, the commute card needs live vehicles (for tracked delays) and service alerts.
  const commute = useCommute()
  const commuteLive = !!commute?.stopId && !!commuteWindow(commute, now)?.active
  const { vehicles: allVehicles, error: vehicleError } = useLiveVehicles(
    layers.vehicles || !!sel.vehicle || sel.transit?.kind === 'line' || sel.transit?.kind === 'stop' || sel.transit?.kind === 'trip' || commuteLive,
  )
  const { alerts: transitAlerts, error: transitAlertsError } = useTransitAlerts(
    transitOpen || !!sel.vehicle || alertSettings.routes.length > 0 || (commuteLive && !!commute?.route),
  )

  const [newsFilter, setNewsFilter] = useState<StoryFilter>(DEFAULT_STORY_FILTER)
  // The news snapshot also carries council centres, cameras and outages, so it is read whenever any of those shows.
  const news = useNews(
    panel === 'news' || timelineOpen || !!sel.locality || layers.news || layers.councilCentres || layers.outages || layers.webcams || layers.floodcams || sel.place?.kind === 'centre' || sel.place?.kind === 'outage' || alertSettings.kinds.news || alertSettings.kinds.newsOfficial,
  )
  const stories = useMemo(() => (news.snapshot ? groupStories(news.snapshot.items) : null), [news.snapshot])
  // Council dashboard cameras join QLDTraffic's, less any QLDTraffic already publishes.
  const cameras = useMemo(() => (news.snapshot?.cameras.length ? [...tmrCameras, ...asCameras(news.snapshot.cameras, tmrCameras)] : tmrCameras), [tmrCameras, news.snapshot])
  // The map shows the stories the News tab's filters leave, and only those that name a place.
  const mapStories = useMemo(() => (stories ? filterStories(stories, newsFilter, now).filter((s) => s.places.length) : []), [stories, newsFilter, now])
  const selectedStory = useMemo(() => (sel.news ? (stories?.find((s) => s.id === sel.news) ?? null) : null), [stories, sel.news])
  const turnOnLayers = useCallback((keys: (keyof MapLayers)[]) => {
    setLayers((l) => (keys.every((k) => l[k]) ? l : { ...l, ...Object.fromEntries(keys.map((k) => [k, true])) }))
  }, [])
  // Opening the News tab turns its map pins on.
  const choosePanel = useCallback(
    (p: Panel) => {
      setPanel(p)
      if (p === 'news') turnOnLayers(['news'])
    },
    [turnOnLayers],
  )
  // Opening a story fits the map to the first road it is placed on, else its first place, once per story.
  // The map's own halo marks the story, so no focus ring is needed.
  const storyFit = useMemo(() => storyBounds(selectedStory), [selectedStory])
  useFocusOnce(storyFit, storyFit && selectedStory ? selectedStory.id : null, (bounds) => setFit({ bounds, id: Date.now() }))

  const openHref = useCallback(
    (href: string) => {
      if (href.startsWith('transit')) setPanel('transit')
      if (href.startsWith('news')) choosePanel('news')
      revealList()
      go(href)
    },
    [go, revealList, choosePanel],
  )

  const notifications = useNotifications({
    settings: alertSettings,
    setSettings: setAlertSettings,
    events,
    eventsAt: fetchedAt,
    transitAlerts,
    fires,
    warnings: qw.warnings,
    stories,
    onOpen: openHref,
  })

  const mapVehicles = useMemo(
    () => allVehicles.filter((v) => vehicleModes.includes(v.mode) && (!vehicleFilter || vehicleFilter.match(v.route))),
    [allVehicles, vehicleModes, vehicleFilter],
  )
  const vehicleCounts = useMemo(() => {
    const c: Partial<Record<VehicleMode, number>> = {}
    for (const v of allVehicles) c[v.mode] = (c[v.mode] ?? 0) + 1
    return c
  }, [allVehicles])
  const selectedVehicle = useMemo(() => allVehicles.find((v) => v.id === sel.vehicle) ?? null, [allVehicles, sel.vehicle])
  // Highlight the selected vehicle's track, else the line shown on the map.
  const trackCodes = useMemo(() => {
    if (selectedVehicle && selectedVehicle.mode !== 'bus' && selectedVehicle.region === 'SEQ') return [selectedVehicle.route]
    if (vehicleFilter && layers.vehicles) return allRouteCodes().filter(vehicleFilter.match)
    return null
  }, [selectedVehicle, vehicleFilter, layers.vehicles])

  // Centre on a vehicle once when it's picked (not on every position update), and again if it's closed and picked later.
  useFocusOnce(
    selectedVehicle,
    selectedVehicle?.id ?? null,
    (v) => {
      turnOnLayers(['vehicles'])
      setFollowVehicle(false)
      setFocus({ center: v.position, zoom: 14, ring: false })
    },
    true,
  )

  const showLineOnMap = useCallback(
    (title: string, match: (code: string) => boolean) => {
      setVehicleFilter({ title, match })
      turnOnLayers(['vehicles'])
      revealMap()
      // Fit the line's track when TransLink publishes one, else its live vehicles.
      loadTracks().then((t) => {
        const track = t && trackBounds(t, match)
        if (track) return setFit({ bounds: track, id: Date.now() })
        const live = pointBounds(allVehicles.filter((v) => match(v.route)).map((v) => v.position))
        if (live) setFit({ bounds: live, id: Date.now() })
      })
    },
    [allVehicles, revealMap, turnOnLayers],
  )

  const districts = useMemo(() => districtsOf(events), [events])
  const visible = useMemo(() => applyFilters(events, filters, userLocation), [events, filters, userLocation])
  const selectedEvent = useMemo(() => events.find((e) => e.properties.id === sel.event) ?? null, [events, sel.event])
  const selectedCamera = useMemo(() => cameras.find((c) => cameraKey(c) === sel.camera) ?? null, [cameras, sel.camera])

  // Brisbane City Council gauges and signals load only when something shows them.
  const { gauges, notice: gaugeNotice } = useGauges(layers.gauges || !!sel.gauge || selectedEvent?.properties.event_type === 'Flooding')
  const { sites: signalSites, volumes: signalVolumes } = useSignals(layers.signals || !!sel.signal)
  const { clearances, error: clearanceError } = useClearances(layers.clearances || sel.place?.kind === 'clearance')
  const council = useCouncilPlaces({
    clearways: layers.clearways || sel.place?.kind === 'clearway',
    toilets: layers.toilets || sel.place?.kind === 'toilet',
    accessibleParking: layers.accessibleParking || sel.place?.kind === 'bay',
    parkingMeters: layers.parkingMeters || sel.place?.kind === 'meter',
    cycling: layers.cycling || sel.place?.kind === 'bike',
    councilEvents: layers.councilEvents || sel.place?.kind === 'event',
  })
  const air = useAirQuality(layers.airQuality || sel.place?.kind === 'air')
  const hot = useHotspots(layers.hotspots || sel.place?.kind === 'hotspot')
  const fireBans = useFireBans(layers.fires)
  const nswFires = useNswFires(layers.nswFires || sel.place?.kind === 'nswfire')
  // Also read while the street map is the base, so a storm near Australia can suggest the satellite view.
  const cyclones = useCyclones(layers.cyclones || sel.place?.kind === 'cyclone' || base === 'map')
  const pastCyclones = usePastCyclones(layers.pastCyclones || sel.place?.kind === 'pastcyclone')
  const speedCameras = useSpeedCameras(layers.speedCameras || sel.place?.kind === 'speedcamera')
  const fuelStations = useFuelStations(layers.fuel || sel.place?.kind === 'fuel')
  const imagery = useSatelliteImagery(base === 'satellite', satelliteSource, now)
  // The live image's frames from the last 3 hours, for the satellite timeline; `frame` is the one picked there, or null to follow the newest.
  const [frame, setFrame] = useState<string | null>(null)
  const allLiveFrames = useMemo(
    () => (isGibsLive(satelliteSource) ? imagery.live.frames : jmaProduct(satelliteSource) ? imagery.jma.frames.map((f) => f.time) : []),
    [satelliteSource, imagery.live.frames, imagery.jma.frames],
  )
  const liveFrames = useMemo(() => recentFrames(allLiveFrames, 3), [allLiveFrames])
  const pickedFrame = frame && liveFrames.includes(frame) ? frame : null
  // One timeline: while Replay runs, the live image follows the replayed moment, using the
  // published frame at or just before it, or none at all, never today's clouds under past events.
  const replayFrame = replayTime != null && allLiveFrames.length ? frameAt(allLiveFrames, replayTime) : undefined
  const shownFrame = replayFrame !== undefined ? replayFrame : pickedFrame
  const replayDate = replayTime != null ? brisbaneDate(replayTime) : null
  const satelliteImage = useMemo(
    () =>
      base === 'satellite' && replayFrame !== null
        ? satelliteTiles(satelliteSource, {
            gibsTime: shownFrame ?? imagery.live.time,
            jmaFrame: (shownFrame && imagery.jma.frames.find((f) => f.time === shownFrame)) || imagery.jma.latest,
            date: replayDate ?? imagery.date,
          })
        : null,
    [base, satelliteSource, replayFrame, shownFrame, replayDate, imagery.live.time, imagery.jma.frames, imagery.jma.latest, imagery.date],
  )
  /** What the saved image's footer says about each shown source and its data time. */
  const imageSources = sourceLines({
    now,
    replayAt: replayTime,
    eventsReadAt: fetchedAt,
    firesReadAt: layers.fires ? firesAt : null,
    satellite: satelliteImage
      ? {
          label: SATELLITE_SOURCES.find((s) => s.value === satelliteSource)?.label ?? satelliteSource,
          time: satelliteImageTime({
            frameTime: shownFrame ?? (isGibsLive(satelliteSource) ? imagery.live.time : imagery.jma.latest?.time) ?? null,
            live: allLiveFrames.length > 0,
            date: replayDate ?? imagery.date,
            now,
          }),
        }
      : null,
  })
  const [dismissed, dismissSuggestion] = useSatelliteDismissals()
  const suggestion = useMemo(
    () => (base === 'map' ? satelliteSuggestion(cyclones.data ?? [], qw.warnings ?? [], dismissed) : null),
    [base, cyclones.data, qw.warnings, dismissed],
  )
  const layerTimesNow = useMemo(
    () => layerTimes({ gauges, airStations: air.stations, cyclones: cyclones.data, newsReadAt: news.snapshot?.fetchedAt ?? null, nswReadAt: nswFires.fetchedAt }),
    [gauges, air.stations, cyclones.data, news.snapshot, nswFires.fetchedAt],
  )
  const firesNewest = useMemo(() => (fires?.length ? Math.max(...fires.map((f) => f.published ?? 0)) || null : null), [fires])
  const selectedGauge = useMemo(() => (sel.gauge ? (gauges?.find((g) => g.id === sel.gauge) ?? null) : null), [gauges, sel.gauge])
  const selectedSignal = useMemo(
    () => (sel.signal ? (signalSites?.find((s) => s.tsc === sel.signal) ?? null) : null),
    [signalSites, sel.signal],
  )
  // Opening a gauge or a signal flies the map to it once.
  useFocusOnce(
    selectedGauge ?? selectedSignal,
    selectedGauge ? `g${selectedGauge.id}` : selectedSignal ? `s${selectedSignal.tsc}` : null,
    (target) => setFocus({ center: target.position, zoom: 15 }),
  )

  const selectedFire = useMemo(() => (sel.fire ? (fires?.find((f) => f.id === sel.fire) ?? null) : null), [fires, sel.fire])

  // A locality page loads the gazetteer on demand and flies the map to the locality once.
  const locality = useLocality(sel.locality)
  useFocusOnce(locality.found, locality.found?.name ?? null, (found) => setFocus({ center: found.position, zoom: 13, ring: false }))
  const localitySources = useMemo(
    (): LocalitySources => ({
      events,
      fires,
      cameras,
      airStations: air.stations,
      centres: news.snapshot?.centres ?? null,
      outages: news.snapshot?.outages ?? null,
      stories,
      gauges,
      errors: { fires: fireError ?? undefined, airStations: air.error ?? undefined, gauges: gaugeNotice ?? undefined },
    }),
    [events, fires, fireError, cameras, air.stations, air.error, news.snapshot, stories, gauges, gaugeNotice],
  )
  // Opening a fire flies the map to it (once per fire, not on every refresh).
  useFocusOnce(selectedFire, selectedFire?.id ?? null, (f) => setFocus({ center: f.position, zoom: f.areaShape ? 10 : 11 }))

  // The tab title names the open view, for history, bookmarks, shared links and screen readers.
  const baseTitle = useRef(document.title)
  useEffect(() => {
    document.title = pageTitle(
      sel,
      { event: selectedEvent ? eventTitle(selectedEvent) : null, locality: locality.found?.name, fire: selectedFire?.title },
      baseTitle.current,
    )
  }, [sel, selectedEvent, locality.found, selectedFire])

  // With the panel hidden (closed on desktop, the Map view on phones), the selected item gets a card on the map instead.
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const cardVisible = isDesktop ? panelMode === 'closed' : mobileView === 'map'
  const selectedPlace = useSelectedPlace(
    sel,
    { ...ref, waze, clearances, clearways: council.clearways, toilets: council.toilets, bays: council.bays, meters: council.meters, bikeStops: council.bikeStops, councilEvents: council.events, councilCentres: news.snapshot?.centres ?? null, outages: news.snapshot?.outages ?? null, airStations: air.stations, hotspots: hot.hotspots, warnings: qw.warnings, nswFires: nswFires.data, cyclones: cyclones.data, pastCyclones: pastCyclones.data, speedCameras: speedCameras.data, fuelStations: fuelStations.data },
    setLayers,
    setFocus,
  )
  const mapCard = useMemo(
    () =>
      cardVisible
        ? mapCardFor({ event: selectedEvent, place: selectedPlace, fire: selectedFire, gauge: selectedGauge, signal: selectedSignal, signalVolumes, vehicle: selectedVehicle, story: selectedStory }, now)
        : null,
    [cardVisible, selectedEvent, selectedPlace, selectedFire, selectedGauge, selectedSignal, signalVolumes, selectedVehicle, selectedStory, now],
  )

  // Keep the selected event on the map even if filters would hide it.
  const mapEvents = useMemo(
    () => (selectedEvent && !visible.includes(selectedEvent) ? [...visible, selectedEvent] : visible),
    [visible, selectedEvent],
  )
  const replay = useMemo(
    () => (replayTime == null ? null : replayAt(replayTime, eventHistory.history, news.snapshot?.items ?? [], gauges ?? [])),
    [replayTime, eventHistory.history, news.snapshot, gauges],
  )
  const replayEvents = useMemo(() => replay?.events.map(asTrafficEvent) ?? [], [replay])
  const replayStories = useMemo(() => (replay ? filterStories(groupStories(replay.items), newsFilter, replay.at).filter((s) => s.places.length) : []), [replay, newsFilter])

  // Header chips: open the event list with a filter applied.
  const showEvents = (next: (f: EventFilters) => EventFilters) => {
    setFilters(next)
    setPanel('events')
    revealList()
    if (sel.transit || sel.event || sel.camera || sel.place || sel.locality || sel.vehicle || sel.fire || sel.gauge || sel.signal || sel.news != null) go('')
  }

  const major = useMemo(
    // Until road events have loaded once, their counts are unknown, not zero.
    () => majorIncidents({ events: fetchedAt == null ? null : events, fires, warnings: qw.warnings, now }),
    [fetchedAt, events, fires, qw.warnings, now],
  )

  const layerCounts = useMemo(
    () =>
      countLayers({
        cameras,
        restAreas: ref.restAreas,
        dumpPoints: ref.dumpPoints,
        trucks: ref.truckRestrictions,
        waze,
        fires,
        warnings: qw.warnings,
        gauges,
        signalVolumes,
        clearances,
        clearways: council.clearways,
        toilets: council.toilets,
        accessibleParking: council.bays,
        parkingMeters: council.meters,
        cycling: council.bikeStops,
        councilEvents: council.events,
        news: news.snapshot,
        airQuality: air.stations,
        hotspots: hot.hotspots,
        stories,
        mapStories,
      }),
    [cameras, ref, waze, fires, gauges, signalVolumes, clearances, council.clearways, council.toilets, council.bays, council.meters, council.bikeStops, council.events, stories, mapStories, news.snapshot, air.stations, hot.hotspots, qw.warnings],
  )

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError('Your browser does not support location.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.longitude, pos.coords.latitude])
        setFilters((f) => ({ ...f, sort: 'nearest' }))
        setLocating(false)
      },
      () => {
        setLocateError('Location permission was denied, so events are sorted by priority instead.')
        setFilters((f) => ({ ...f, sort: 'priority' }))
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }, [])

  const selectEvent = useCallback(
    (id: number) => {
      setPanel('events')
      go(`event/${id}`)
    },
    [go],
  )

  // Closing a camera returns to whatever was open before it (e.g. an event).
  const cameraReturn = useRef('')
  // `reveal` opens the panel for the item; a map tap passes false when the item gets a card on the map instead.
  const openKey = useCallback(
    (hashKey: string, reveal = true) => {
      if (hashKey.startsWith('camera/')) {
        if (!location.hash.startsWith('#camera/')) cameraReturn.current = location.hash.replace(/^#/, '')
        revealMap()
        const cam = cameras.find((c) => `camera/${cameraKey(c)}` === hashKey)
        if (cam) turnOnLayers([cam.kind === 'webcam' ? 'webcams' : 'floodcams'])
      } else if (hashKey.startsWith('newsplace/')) {
        // A pin several stories share opens the News list for that place.
        setNewsFilter({ ...DEFAULT_STORY_FILTER, place: decodeURIComponent(hashKey.slice('newsplace/'.length)) })
        choosePanel('news')
        revealList()
        go('news')
        return
      } else if (reveal) {
        revealList()
      }
      go(hashKey)
    },
    [go, cameras, revealMap, revealList, choosePanel, turnOnLayers],
  )
  const closeCamera = useCallback(() => go(cameraReturn.current), [go])

  // The header search looks through whatever is loaded; it reads the towns, stops and lines itself.
  const searchSources = useMemo<LoadedSources>(
    () => ({
      events,
      cameras,
      restAreas: ref.restAreas,
      dumpPoints: ref.dumpPoints,
      truckRestrictions: ref.truckRestrictions,
      clearances,
      toilets: council.toilets,
      bays: council.bays,
      meters: council.meters,
      bikeStops: council.bikeStops,
      councilEvents: council.events,
      stories,
      centres: news.snapshot?.centres ?? null,
      outages: news.snapshot?.outages ?? null,
      airStations: air.stations,
      gauges,
      fires,
      warnings: qw.warnings,
      fuel: fuelStations.data,
      speedCameras: speedCameras.data,
    }),
    [events, cameras, ref, clearances, council.toilets, council.bays, council.meters, council.bikeStops, council.events, stories, news.snapshot, air.stations, gauges, fires, qw.warnings, fuelStations.data, speedCameras.data],
  )
  // A search result opens like a tap on the map; a road event also brings back the events list.
  const openSearchHit = useCallback(
    (href: string) => {
      if (href.startsWith('event/')) choosePanel('events')
      openKey(href)
    },
    [openKey, choosePanel],
  )

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-kumo-canvas">
        <SkipLinks revealList={revealList} revealMap={revealMap} />
        <AppHeader
          mode={mode}
          onToggleMode={toggle}
          now={now}
          events={events}
          cameraCount={cameras.length}
          firstLoad={firstLoad}
          panel={panel}
          transitOpen={transitOpen}
          filters={filters}
          onShowEvents={showEvents}
          onShowCameras={() => {
            setPanel('cameras')
            revealList()
            if (sel.transit || sel.news != null) go('')
          }}
          onHome={() => go('')}
          notifications={notifications}
          onOpenHref={openHref}
          onAlertSettings={() => setSettingsOpen(true)}
          alertSettings={alertSettings}
          onAlertSettingsChange={setAlertSettings}
          onFeedback={() => setFeedbackOpen(true)}
          searchSources={searchSources}
          onOpenSearch={openSearchHit}
          error={error}
          fetchedAt={fetchedAt}
          loading={loading}
          refreshing={refreshing}
          onRefresh={refresh}
          panelExpanded={panelMode === 'expanded'}
          onTogglePanelExpanded={() => setPanelMode((m) => (m === 'expanded' ? 'normal' : 'expanded'))}
          visitors={visitors}
        />
        <MajorStrip summary={major} onOpen={openHref} onShowEvents={showEvents} feedStatus={feedStatus(error, fetchedAt, now)} />

        {(error || locateError) && (
          <div className="grid gap-2 border-b border-kumo-line bg-kumo-base px-4 py-2">
            {error && (
              <Banner
                variant="error"
                size="sm"
                icon={<WarningCircleIcon weight="fill" />}
                title="Couldn't load the latest events"
                description={events.length ? `${error} Showing the last data received.` : error}
                action={<Banner.Action onClick={refresh}>Retry</Banner.Action>}
              />
            )}
            {locateError && <Banner variant="alert" size="sm" description={locateError} />}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <aside
            id={VIEW_IDS.list}
            tabIndex={-1}
            aria-label="List"
            className={`${mobileView === 'list' ? 'flex' : 'hidden'} w-full outline-none shrink-0 flex-col border-r border-kumo-line bg-kumo-base ${
              panelMode === 'closed' ? 'md:hidden' : panelMode === 'expanded' ? 'md:flex md:flex-1' : 'md:flex md:w-[420px]'
            }`}
          >
            {/* While the panel fills the window, a clear way back to the map. */}
            {panelMode === 'expanded' && (
              <div className="hidden shrink-0 items-center border-b border-kumo-line px-2 py-1 md:flex">
                <Button size="sm" variant="ghost" icon={<ArrowsInSimpleIcon />} title="Back to the map (Esc)" onClick={() => setPanelMode('normal')}>
                  Back to the map
                </Button>
              </div>
            )}
            {/* Full screen: keep lines and lists at a readable width. */}
            <div className={`flex min-h-0 w-full flex-1 flex-col ${panelMode === 'expanded' ? 'md:mx-auto md:max-w-5xl' : ''}`}>
              <SidePanel
                sel={sel}
                onNavigate={go}
                onOpenHref={openHref}
                onOpenCamera={(k) => openKey(`camera/${k}`)}
                onSelectEvent={selectEvent}
                onRevealMap={revealMap}
                now={now}
                panel={panel}
                onPanelChange={choosePanel}
                transitOpen={transitOpen}
                events={events}
                eventsAt={fetchedAt}
                eventsError={error}
                visibleEvents={visible}
                selectedEvent={selectedEvent}
                districts={districts}
                filters={filters}
                onFiltersChange={setFilters}
                loading={loading}
                loadError={fetchedAt ? null : error}
                onRetry={refresh}
                userLocation={userLocation}
                locating={locating}
                onLocate={locate}
                occupancies={occupancies}
                cameras={cameras}
                vehicles={allVehicles}
                vehicleError={vehicleError}
                selectedVehicle={selectedVehicle}
                followVehicle={followVehicle}
                onToggleFollow={() => {
                  setFollowVehicle((f) => !f)
                  revealMap()
                }}
                transitAlerts={transitAlerts}
                transitAlertsError={transitAlertsError}
                onShowLineOnMap={showLineOnMap}
                mapView={mapView}
                selectedPlace={selectedPlace}
                fires={fires}
                fireBans={fireBans.data}
                fireNotice={fireNotice}
                warnings={qw.warnings}
                warningNotice={warningNotice}
                selectedFire={selectedFire}
                gauges={gauges}
                gaugeNotice={gaugeNotice}
                selectedGauge={selectedGauge}
                selectedSignal={selectedSignal}
                signalVolumes={signalVolumes}
                news={{ snapshot: news.snapshot, error: news.error, stories: stories ?? [] }}
                newsFilter={newsFilter}
                onNewsFilterChange={setNewsFilter}
                selectedStory={selectedStory}
                onShowNewsPlace={(p) => {
                  setFocus({ center: p.position, zoom: 12 })
                  revealMap()
                }}
                onShowNewsRoad={(r) => {
                  setFit({ bounds: roadBounds(r), id: Date.now() })
                  revealMap()
                }}
                alertSettings={alertSettings}
                notifications={notifications}
                locality={{
                  found: locality.found,
                  loading: locality.loading,
                  sources: localitySources,
                  onShowOnMap: (center, keys) => {
                    turnOnLayers(keys)
                    setFocus({ center, zoom: 13, ring: false })
                    revealMap()
                  },
                  onTurnOnLayer: (key) => turnOnLayers([key]),
                }}
              />
            </div>

          </aside>

          <main
            id={VIEW_IDS.map}
            tabIndex={-1}
            aria-label="Map"
            className={`${mobileView === 'map' ? 'block' : 'hidden'} relative outline-none min-w-0 flex-1 ${panelMode === 'expanded' ? 'md:hidden' : 'md:block'}`}
          >
            {/* Edge tab, as in Google Maps: hide the panel for a full map, or bring it back. */}
            <button
              type="button"
              onClick={() => setPanelMode((m) => (m === 'closed' ? 'normal' : 'closed'))}
              aria-label={panelMode === 'closed' ? 'Show panel' : 'Hide panel'}
              title={panelMode === 'closed' ? 'Show panel' : 'Hide panel for a full map'}
              className="absolute top-1/2 left-0 z-20 hidden h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r-md bg-kumo-base text-kumo-subtle shadow-sm ring ring-kumo-line hover:text-kumo-default md:flex"
            >
              {panelMode === 'closed' ? <CaretRightIcon size={14} weight="bold" /> : <CaretLeftIcon size={14} weight="bold" />}
            </button>
            {panelMode === 'closed' && (
              <Button
                size="sm"
                icon={<SidebarSimpleIcon />}
                className="absolute bottom-16 left-3 z-20 hidden shadow-md md:inline-flex"
                onClick={() => setPanelMode('normal')}
              >
                Show panel
              </Button>
            )}
            <TrafficMap
              mode={mode}
              basemap={basemap}
              now={now}
              events={replay ? replayEvents : mapEvents}
              cameras={cameras}
              restAreas={ref.restAreas}
              dumpPoints={ref.dumpPoints}
              waze={waze}
              trucks={ref.truckRestrictions}
              districts={ref.districts}
              district={filters.district}
              layers={layers}
              crashFilter={crashFilter}
              vehicles={mapVehicles}
              fires={fires ?? []}
              warnings={qw.warnings ?? []}
              gauges={replay ? replay.gauges : (gauges ?? [])}
              replayAt={replay?.at ?? null}
              signalSites={signalSites ?? []}
              signalVolumes={signalVolumes}
              clearances={clearances ?? []}
              clearways={council.clearways ?? []}
              toilets={council.toilets ?? []}
              accessibleBays={council.bays ?? []}
              parkingMeters={council.meters ?? []}
              bikeStops={council.bikeStops ?? []}
              councilEvents={council.events ?? []}
              councilCentres={news.snapshot?.centres ?? []}
              outages={news.snapshot?.outages ?? []}
              airStations={air.stations ?? []}
              hotspots={hot.hotspots ?? []}
              satelliteImage={satelliteImage}
              imageSources={imageSources}
              nswFires={nswFires.data ?? []}
              cyclones={cyclones.data ?? []}
              pastCyclones={pastCyclones.data ?? []}
              speedCameras={speedCameras.data ?? []}
              fuelStations={fuelStations.data ?? []}
              newsStories={replay ? replayStories : mapStories}
              selectedStory={selectedStory}
              selectedVehicleId={sel.vehicle}
              card={mapCard}
              onCardDetails={revealList}
              onCardClose={() => go('')}
              trackCodes={trackCodes}
              followVehicle={followVehicle && !!selectedVehicle}
              fit={fit}
              selectedEvent={selectedEvent}
              selectedCamera={selectedCamera}
              focus={focus}
              userLocation={userLocation}
              onSelectEvent={(id) => {
                selectEvent(id)
                if (!cardVisible) revealList()
              }}
              onSelectKey={(k) => openKey(k, !cardVisible)}
              onCloseCamera={closeCamera}
              onOpenLocality={(name) => openHref(`place/locality/${encodeURIComponent(name)}`)}
              onViewChange={setMapView}
            />
            <MapLayersPanel
              basemap={basemap}
              onBasemapChange={setBasemap}
              layers={layers}
              counts={layerCounts}
              onChange={setLayers}
              crashFilter={crashFilter}
              onCrashFilterChange={setCrashFilter}
              vehicleModes={vehicleModes}
              onVehicleModesChange={setVehicleModes}
              vehicleCounts={vehicleCounts}
              vehicleError={vehicleError}
              clearanceError={clearanceError}
              unplacedOutages={news.snapshot?.outages.filter(isUnplaced).length ?? 0}
              airError={air.error}
              fireState={{ newest: firesNewest, notice: fireNotice, fetchedAt: firesAt, now }}
              warningState={{ count: qw.warnings?.length ?? null, notice: warningNotice, fetchedAt: qw.fetchedAt, now }}
              gaugeNotice={gaugeNotice}
              hotspotState={{ hasData: hot.hotspots != null, error: hot.error, fetchedAt: hot.fetchedAt, newest: hot.hotspots?.[0]?.observedAt ?? null, now }}
              base={base}
              onBaseChange={setBase}
              times={{ latest: layerTimesNow, now }}
              aside={
                suggestion && (
                  <SatelliteSuggestion
                    suggestion={suggestion}
                    onShow={() => setBase('satellite')}
                    onDismiss={() => dismissSuggestion(suggestion.key)}
                  />
                )
              }
              imagery={{ source: satelliteSource, onSource: (s) => (setSatelliteSource(s), setFrame(null)), now, live: imagery.live, jma: imagery.jma, date: imagery.date, latest: imagery.latest, checking: imagery.checking, error: imagery.error, today: imagery.today, onPick: imagery.pick }}
              hazards={{ fireBans, nswFires, cyclones, pastCyclones, speedCameras, fuel: fuelStations }}
              councilErrors={council.errors}
            />
            {base === 'satellite' && !timelineOpen && (
              <div className="pointer-events-none absolute inset-x-3 bottom-20 z-10 flex justify-center max-md:bottom-32 [&>*]:pointer-events-auto">
                <SatelliteTimeline
                  frames={liveFrames}
                  current={shownFrame}
                  onChange={setFrame}
                  now={now}
                  source={isGibsLive(satelliteSource) ? 'NASA GIBS' : 'JMA'}
                />
              </div>
            )}
            {timelineOpen ? (
              <>
                {replay && <ReplayBanner at={replay.at} run={replay.run} className="absolute top-14 right-14 left-3 z-10 text-center xl:inset-x-auto xl:top-3 xl:left-1/2 xl:-translate-x-1/2 xl:whitespace-nowrap" />}
                {replay && base === 'satellite' && replayFrame === null && (
                  <p role="status" className="absolute inset-x-3 top-28 z-10 mx-auto w-fit max-w-md rounded-md bg-kumo-base px-3 py-1.5 text-center text-sm shadow-md ring ring-kumo-line xl:top-14">
                    No satellite image was published within 20 minutes of this time, so none is shown.
                  </p>
                )}
                <Timeline
                  now={now}
                  state={timeline}
                  history={eventHistory.history}
                  error={eventHistory.error}
                  run={replay?.run ?? null}
                  onClose={() => {
                    timeline.live()
                    setTimelineOpen(false)
                  }}
                  className="absolute inset-x-3 bottom-8 z-10 md:mx-auto md:max-w-2xl"
                />
              </>
            ) : (
              <Button size="sm" icon={<ClockCounterClockwiseIcon />} className="absolute right-3 bottom-10 z-10 shadow-md" title="Replay the last 48 hours as it was published" onClick={() => setTimelineOpen(true)}>
                Replay
              </Button>
            )}
            {vehicleFilter && layers.vehicles && (
              // On phones it sits a row above the Replay button, which shares its line at bottom-10.
              <div
                className={`absolute ${timelineOpen ? 'bottom-36' : 'bottom-10 max-md:bottom-20'} left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-kumo-base py-1 pr-1 pl-3 text-sm shadow-md ring ring-kumo-line`}
              >
                <span className="min-w-0 truncate">
                  Showing <span className="font-medium">{vehicleFilter.title}</span> · {mapVehicles.length} live
                </span>
                <Button size="xs" variant="ghost" onClick={() => setVehicleFilter(null)}>
                  Show all
                </Button>
              </div>
            )}
          </main>
        </div>

        <nav className="flex shrink-0 justify-center border-t border-kumo-line bg-kumo-base px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <Tabs
            className="w-full"
            listClassName="w-full [&>*]:flex-1"
            value={mobileView}
            onValueChange={(v) => (v === 'map' ? revealMap() : revealList())}
            tabs={[
              {
                value: 'list',
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <ListIcon /> List
                  </span>
                ),
              },
              {
                value: 'map',
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <MapTrifoldIcon /> Map
                  </span>
                ),
              },
            ]}
          />
        </nav>
        <AlertSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={alertSettings}
          onChange={setAlertSettings}
          districts={districts}
          events={events}
        />
        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      </div>
    </TooltipProvider>
  )
}
