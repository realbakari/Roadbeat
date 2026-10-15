import { Banner, Button, Tabs, TooltipProvider } from '@cloudflare/kumo'
import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  CaretLeftIcon,
  CaretRightIcon,
  SidebarSimpleIcon,
  ListIcon,
  MapTrifoldIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CRASH_FILTER, type CrashFilter } from './api/crashes'
import { loadTracks, trackBounds } from './api/tracks'
import { allRouteCodes, type VehicleMode } from './api/translink'
import { AlertSettingsDialog } from './components/AlertSettingsDialog'
import { AppHeader } from './components/AppHeader'
import { commuteWindow } from './lib/commute'
import { useCommute } from './lib/commuteStore'
import { useAlertSettings, useNotifications } from './hooks/useNotifications'
import { MapLayersPanel } from './components/MapLayersPanel'
import { SidePanel, type Panel } from './components/SidePanel'
import { TrafficMap } from './components/TrafficMap'
import { DEFAULT_LAYERS, type Basemap, type MapLayers } from './components/map/settings'
import { useColorMode } from './hooks/useColorMode'
import { usePanelLayout } from './hooks/usePanelLayout'
import { useHashSelection, useSelectedPlace, type MapFocus } from './hooks/useSelection'
import { useBushfires, useClearances, useCouncilPlaces, useRoadOccupancies, useGauges, useLiveVehicles, useSignals, useNow, useReferenceData, useTrafficData, useTransitAlerts } from './hooks/useTrafficData'
import { applyFilters, DEFAULT_FILTERS, districtsOf, type EventFilters } from './lib/filters'
import { cameraKey, type Bounds, type LngLat } from './lib/geo'

export default function App() {
  const { mode, toggle } = useColorMode()
  const { events, cameras, waze, loading, refreshing, error, fetchedAt, refresh } = useTrafficData()
  // Bushfire warnings are always fetched: they're on the map and list by default and feed notifications.
  const { fires } = useBushfires(true)
  const firstLoad = loading && fetchedAt == null
  const ref = useReferenceData()
  const now = useNow()

  const [panel, setPanel] = useState<Panel>('events')
  const occupancies = useRoadOccupancies(panel === 'events')
  const { mobileView, panelMode, setPanelMode, revealMap, revealList } = usePanelLayout()
  const [mapView, setMapView] = useState<{ center: LngLat; zoom: number } | null>(null)
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS)
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS)
  // Base map style and 3D buildings are remembered in this browser.
  const [basemap, setBasemapState] = useState<Basemap>(() => {
    try {
      const v = localStorage.getItem('qldt-basemap')
      return v === 'detailed' || v === 'bright' || v === 'night' ? v : 'standard'
    } catch {
      return 'standard'
    }
  })
  const setBasemap = (b: Basemap) => {
    setBasemapState(b)
    try {
      localStorage.setItem('qldt-basemap', b)
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }
  const [crashFilter, setCrashFilter] = useState<CrashFilter>(DEFAULT_CRASH_FILTER)
  const [userLocation, setUserLocation] = useState<LngLat | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [sel, go] = useHashSelection()
  const [alertSettings, setAlertSettings] = useAlertSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [vehicleModes, setVehicleModes] = useState<VehicleMode[]>(['train', 'bus', 'tram', 'ferry'])
  const [vehicleFilter, setVehicleFilter] = useState<{ title: string; match: (code: string) => boolean } | null>(null)
  const [followVehicle, setFollowVehicle] = useState(false)
  const [fit, setFit] = useState<{ bounds: Bounds; id: number } | null>(null)

  const transitOpen = panel === 'transit' || !!sel.transit
  // During the commute window, the commute card needs live vehicles (for tracked delays) and service alerts.
  const commute = useCommute()
  const commuteLive = !!commute?.stopId && !!commuteWindow(commute, now)?.active
  const { vehicles: allVehicles, error: vehicleError } = useLiveVehicles(
    layers.vehicles || !!sel.vehicle || sel.transit?.kind === 'line' || sel.transit?.kind === 'stop' || commuteLive,
  )
  const { alerts: transitAlerts, error: transitAlertsError } = useTransitAlerts(
    transitOpen || !!sel.vehicle || alertSettings.routes.length > 0 || (commuteLive && !!commute?.route),
  )

  const openHref = useCallback(
    (href: string) => {
      if (href.startsWith('transit')) setPanel('transit')
      revealList()
      go(href)
    },
    [go, revealList],
  )

  const notifications = useNotifications({
    settings: alertSettings,
    setSettings: setAlertSettings,
    events,
    eventsAt: fetchedAt,
    transitAlerts,
    fires,
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

  // Centre on a vehicle once when it's picked (not on every position update).
  const focusedVehicle = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedVehicle) {
      focusedVehicle.current = null
      return
    }
    if (focusedVehicle.current === selectedVehicle.id) return
    focusedVehicle.current = selectedVehicle.id
    setLayers((l) => (l.vehicles ? l : { ...l, vehicles: true }))
    setFollowVehicle(false)
    setFocus({ center: selectedVehicle.position, zoom: 14, ring: false })
  }, [selectedVehicle])

  const showLineOnMap = useCallback(
    (title: string, match: (code: string) => boolean) => {
      setVehicleFilter({ title, match })
      setLayers((l) => (l.vehicles ? l : { ...l, vehicles: true }))
      revealMap()
      // Fit the line's track when TransLink publishes one, else its live vehicles.
      loadTracks().then((t) => {
        const track = t && trackBounds(t, match)
        if (track) return setFit({ bounds: track, id: Date.now() })
        const pts = allVehicles.filter((v) => match(v.route)).map((v) => v.position)
        if (!pts.length) return
        const xs = pts.map((p) => p[0])
        const ys = pts.map((p) => p[1])
        setFit({ bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], id: Date.now() })
      })
    },
    [allVehicles, revealMap],
  )

  const districts = useMemo(() => districtsOf(events), [events])
  const visible = useMemo(() => applyFilters(events, filters, userLocation), [events, filters, userLocation])
  const selectedEvent = useMemo(() => events.find((e) => e.properties.id === sel.event) ?? null, [events, sel.event])
  const selectedCamera = useMemo(() => cameras.find((c) => cameraKey(c) === sel.camera) ?? null, [cameras, sel.camera])

  // Brisbane City Council gauges and signals load only when something shows them.
  const { gauges } = useGauges(layers.gauges || !!sel.gauge || selectedEvent?.properties.event_type === 'Flooding')
  const { sites: signalSites, volumes: signalVolumes } = useSignals(layers.signals || !!sel.signal)
  const { clearances, error: clearanceError } = useClearances(layers.clearances || sel.place?.kind === 'clearance')
  const council = useCouncilPlaces({
    clearways: layers.clearways || sel.place?.kind === 'clearway',
    toilets: layers.toilets || sel.place?.kind === 'toilet',
    accessibleParking: layers.accessibleParking || sel.place?.kind === 'bay',
  })
  const selectedGauge = useMemo(() => (sel.gauge ? (gauges?.find((g) => g.id === sel.gauge) ?? null) : null), [gauges, sel.gauge])
  const selectedSignal = useMemo(
    () => (sel.signal ? (signalSites?.find((s) => s.tsc === sel.signal) ?? null) : null),
    [signalSites, sel.signal],
  )
  // Opening a gauge or a signal flies the map to it once.
  const focusedPoint = useRef<string | null>(null)
  useEffect(() => {
    const target = selectedGauge ?? selectedSignal
    const key = selectedGauge ? `g${selectedGauge.id}` : selectedSignal ? `s${selectedSignal.tsc}` : null
    if (!target || !key || focusedPoint.current === key) return
    focusedPoint.current = key
    setFocus({ center: target.position, zoom: 15 })
  }, [selectedGauge, selectedSignal])

  const selectedFire = useMemo(() => (sel.fire ? (fires?.find((f) => f.id === sel.fire) ?? null) : null), [fires, sel.fire])
  // Opening a fire flies the map to it (once per fire, not on every refresh).
  const focusedFire = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedFire || focusedFire.current === selectedFire.id) return
    focusedFire.current = selectedFire.id
    setFocus({ center: selectedFire.position, zoom: selectedFire.areaShape ? 10 : 11 })
  }, [selectedFire])

  const selectedPlace = useSelectedPlace(
    sel,
    { ...ref, waze, clearances, clearways: council.clearways, toilets: council.toilets, bays: council.bays },
    setLayers,
    setFocus,
  )

  // Keep the selected event on the map even if filters would hide it.
  const mapEvents = useMemo(
    () => (selectedEvent && !visible.includes(selectedEvent) ? [...visible, selectedEvent] : visible),
    [visible, selectedEvent],
  )

  // Header chips: open the event list with a filter applied.
  const showEvents = (next: (f: EventFilters) => EventFilters) => {
    setFilters(next)
    setPanel('events')
    revealList()
    if (sel.transit || sel.event || sel.camera || sel.place || sel.vehicle || sel.fire || sel.gauge || sel.signal) go('')
  }

  const layerCounts = useMemo(
    () => ({
      webcams: cameras.filter((c) => c.kind === 'webcam').length,
      floodcams: cameras.filter((c) => c.kind === 'floodcam').length,
      restAreas: ref.restAreas.length,
      dumpPoints: ref.dumpPoints.length,
      trucks: ref.truckRestrictions.length,
      waze: waze.length,
      ...(fires ? { fires: fires.length } : {}),
      ...(gauges ? { gauges: gauges.length } : {}),
      ...(signalVolumes ? { signals: signalVolumes.size } : {}),
      ...(clearances ? { clearances: clearances.length } : {}),
      ...(council.clearways ? { clearways: council.clearways.length } : {}),
      ...(council.toilets ? { toilets: council.toilets.length } : {}),
      ...(council.bays ? { accessibleParking: council.bays.length } : {}),
    }),
    [cameras, ref, waze, fires, gauges, signalVolumes, clearances, council.clearways, council.toilets, council.bays],
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
  const openKey = useCallback(
    (hashKey: string) => {
      if (hashKey.startsWith('camera/')) {
        if (!location.hash.startsWith('#camera/')) cameraReturn.current = location.hash.replace(/^#/, '')
        revealMap()
        const cam = cameras.find((c) => `camera/${cameraKey(c)}` === hashKey)
        if (cam) setLayers((l) => (cam.kind === 'webcam' ? (l.webcams ? l : { ...l, webcams: true }) : l.floodcams ? l : { ...l, floodcams: true }))
      } else {
        revealList()
      }
      go(hashKey)
    },
    [go, cameras, revealMap, revealList],
  )
  const closeCamera = useCallback(() => go(cameraReturn.current), [go])

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-kumo-canvas">
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
            if (sel.transit) go('')
          }}
          onHome={() => go('')}
          notifications={notifications}
          onOpenHref={openHref}
          onAlertSettings={() => setSettingsOpen(true)}
          error={error}
          fetchedAt={fetchedAt}
          loading={loading}
          refreshing={refreshing}
          onRefresh={refresh}
        />

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
            className={`${mobileView === 'list' ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-r border-kumo-line bg-kumo-base ${
              panelMode === 'closed' ? 'md:hidden' : panelMode === 'expanded' ? 'md:flex md:flex-1' : 'md:flex md:w-[420px]'
            }`}
          >
            {/* Panel controls, on every screen from tablet width up. */}
            <div className="hidden shrink-0 items-center justify-end gap-1 border-b border-kumo-line px-2 py-1 md:flex">
              <nav aria-label="About Roadbeat" className="mr-auto flex gap-3 pl-1 text-xs text-kumo-subtle">
                <a href="/about/" className="hover:text-kumo-default hover:underline">About</a>
                <a href="/privacy/" className="hover:text-kumo-default hover:underline">Privacy</a>
                <a href="/contact/" className="hover:text-kumo-default hover:underline">Contact</a>
                <a href="/dashboard" className="hover:text-kumo-default hover:underline" title="Network dashboard for a TV or second screen">Dashboard</a>
              </nav>
              <Button
                size="xs"
                variant="ghost"
                icon={panelMode === 'expanded' ? <ArrowsInSimpleIcon /> : <ArrowsOutSimpleIcon />}
                title={panelMode === 'expanded' ? 'Back to the map (Esc)' : 'Show this panel full screen'}
                onClick={() => setPanelMode((m) => (m === 'expanded' ? 'normal' : 'expanded'))}
              >
                {panelMode === 'expanded' ? 'Exit full screen' : 'Full screen'}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                icon={<SidebarSimpleIcon />}
                title="Hide this panel for a full map"
                onClick={() => setPanelMode('closed')}
              >
                Hide panel
              </Button>
            </div>
            {/* Full screen: keep lines and lists at a readable width. */}
            <div className={`flex min-h-0 w-full flex-1 flex-col ${panelMode === 'expanded' ? 'md:mx-auto md:max-w-5xl' : ''}`}>
              <SidePanel
                sel={sel}
                go={go}
                onOpenHref={openHref}
                onOpenCamera={(k) => openKey(`camera/${k}`)}
                onSelectEvent={selectEvent}
                revealMap={revealMap}
                now={now}
                panel={panel}
                onPanelChange={setPanel}
                transitOpen={transitOpen}
                events={events}
                visibleEvents={visible}
                selectedEvent={selectedEvent}
                districts={districts}
                filters={filters}
                onFiltersChange={setFilters}
                loading={loading}
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
                selectedFire={selectedFire}
                gauges={gauges}
                selectedGauge={selectedGauge}
                selectedSignal={selectedSignal}
                signalVolumes={signalVolumes}
                alertSettings={alertSettings}
                notifications={notifications}
              />
            </div>

          </aside>

          <main
            className={`${mobileView === 'map' ? 'block' : 'hidden'} relative min-w-0 flex-1 ${panelMode === 'expanded' ? 'md:hidden' : 'md:block'}`}
          >
            {/* Edge tab, as in Google Maps: hide the panel for a full map, or bring it back. */}
            <button
              type="button"
              onClick={() => setPanelMode((m) => (m === 'closed' ? 'normal' : 'closed'))}
              aria-label={panelMode === 'closed' ? 'Show panel' : 'Hide panel'}
              title={panelMode === 'closed' ? 'Show panel' : 'Hide panel for a full map'}
              className="absolute top-1/2 left-0 z-20 hidden h-12 w-5 -translate-y-1/2 items-center justify-center rounded-r-md bg-kumo-base text-kumo-subtle shadow-sm ring ring-kumo-line hover:text-kumo-default md:flex"
            >
              {panelMode === 'closed' ? <CaretRightIcon size={14} weight="bold" /> : <CaretLeftIcon size={14} weight="bold" />}
            </button>
            {panelMode === 'closed' && (
              <Button
                size="sm"
                icon={<SidebarSimpleIcon />}
                className="absolute bottom-10 left-3 z-20 hidden shadow-md md:inline-flex"
                onClick={() => setPanelMode('normal')}
              >
                Show panel
              </Button>
            )}
            <TrafficMap
              mode={mode}
              basemap={basemap}
              now={now}
              events={mapEvents}
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
              gauges={gauges ?? []}
              signalSites={signalSites ?? []}
              signalVolumes={signalVolumes}
              clearances={clearances ?? []}
              clearways={council.clearways ?? []}
              toilets={council.toilets ?? []}
              accessibleBays={council.bays ?? []}
              selectedVehicleId={sel.vehicle}
              trackCodes={trackCodes}
              followVehicle={followVehicle && !!selectedVehicle}
              fit={fit}
              selectedEvent={selectedEvent}
              selectedCamera={selectedCamera}
              focus={focus}
              userLocation={userLocation}
              onSelectEvent={(id) => {
                selectEvent(id)
                revealList()
              }}
              onSelectKey={openKey}
              onCloseCamera={closeCamera}
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
              councilErrors={council.errors}
            />
            {vehicleFilter && layers.vehicles && (
              <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-kumo-base py-1 pr-1 pl-3 text-sm shadow-md ring ring-kumo-line">
                <span className="whitespace-nowrap">
                  Showing <span className="font-medium">{vehicleFilter.title}</span> · {mapVehicles.length} live
                </span>
                <Button size="xs" variant="ghost" onClick={() => setVehicleFilter(null)}>
                  Show all
                </Button>
              </div>
            )}
          </main>
        </div>

        <nav className="flex shrink-0 justify-center border-t border-kumo-line bg-kumo-base px-4 py-2 md:hidden">
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
      </div>
    </TooltipProvider>
  )
}
