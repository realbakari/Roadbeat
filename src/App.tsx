import { Banner, Button, Loader, Tabs, Text, Tooltip, TooltipProvider } from '@cloudflare/kumo'
import {
  ArrowClockwiseIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  CaretLeftIcon,
  CaretRightIcon,
  SidebarSimpleIcon,
  CarProfileIcon,
  ListIcon,
  MapTrifoldIcon,
  MoonIcon,
  ProhibitIcon,
  SirenIcon,
  SunIcon,
  TrafficConeIcon,
  VideoCameraIcon,
  WarningCircleIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CRASH_FILTER, type CrashFilter } from './api/crashes'
import { loadTracks, trackBounds } from './api/tracks'
import { allRouteCodes, type VehicleMode } from './api/translink'
import { AlertSettingsDialog } from './components/AlertSettingsDialog'
import { NotificationCenter } from './components/NotificationCenter'
import { InstallApp } from './components/InstallApp'
import { VehicleDetail } from './components/VehicleDetail'
import { useAlertSettings, useNotifications } from './hooks/useNotifications'
import { CameraGrid } from './components/CameraGrid'
import { EventDetail } from './components/EventDetail'
import { EventList } from './components/EventList'
import { MapLayersPanel } from './components/MapLayersPanel'
import { PlaceDetail, type Place } from './components/PlaceDetail'
import { FireDetail } from './components/FireDetail'
import { GaugeDetail } from './components/GaugeDetail'
import { SignalDetail } from './components/SignalDetail'
import { TrafficMap } from './components/TrafficMap'
import { DEFAULT_LAYERS, type Basemap, type MapLayers } from './components/map/settings'
import { TransitPanel } from './components/TransitPanel'
import { parseHash } from './lib/route'
import { useColorMode } from './hooks/useColorMode'
import { useBushfires, useGauges, useLiveVehicles, useSignals, useNow, useReferenceData, useTrafficData, useTransitAlerts } from './hooks/useTrafficData'
import { applyFilters, DEFAULT_FILTERS, districtsOf, isClosure, isUpcoming, type EventFilters } from './lib/filters'
import { timeAgo } from './lib/format'
import { cameraKey, type Bounds, type LngLat } from './lib/geo'

type Panel = 'events' | 'cameras' | 'transit'


type PanelMode = 'normal' | 'expanded' | 'closed'

function readPanelMode(): PanelMode {
  try {
    const v = localStorage.getItem('qldt-panel')
    return v === 'expanded' || v === 'closed' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

function useHashSelection() {
  const [sel, setSel] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => setSel(parseHash(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((hash: string) => {
    if (hash) location.hash = hash
    else history.pushState(null, '', location.pathname + location.search)
    setSel(parseHash(location.hash))
  }, [])
  return [sel, go] as const
}

export default function App() {
  const { mode, toggle } = useColorMode()
  const { events, cameras, waze, loading, refreshing, error, fetchedAt, refresh } = useTrafficData()
  // Bushfire warnings are always fetched: they're on the map and list by default and feed notifications.
  const { fires } = useBushfires(true)
  const firstLoad = loading && fetchedAt == null
  const ref = useReferenceData()
  const now = useNow()

  const [panel, setPanel] = useState<Panel>('events')
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  // Desktop panel: today's width, full screen for detail, or closed for a full map. Remembered per browser.
  const [panelMode, setPanelModeState] = useState<PanelMode>(readPanelMode)
  const setPanelMode = useCallback((m: PanelMode | ((m: PanelMode) => PanelMode)) => {
    setPanelModeState((prev) => {
      const next = typeof m === 'function' ? m(prev) : m
      try {
        localStorage.setItem('qldt-panel', next)
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
      return next
    })
  }, [])
  /** Shows the map: on phones the Map view, on desktop leaving full-screen panel mode. */
  const revealMap = useCallback(() => {
    setMobileView('map')
    setPanelMode((m) => (m === 'expanded' ? 'normal' : m))
  }, [setPanelMode])
  /** Shows the panel: on phones the List view, on desktop reopening it if closed. */
  const revealList = useCallback(() => {
    setMobileView('list')
    setPanelMode((m) => (m === 'closed' ? 'normal' : m))
  }, [setPanelMode])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="listbox"]')) return // let open dialogs and menus close first
      setPanelMode((m) => (m === 'expanded' ? 'normal' : m))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPanelMode])
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
  const [focus, setFocus] = useState<{ center: LngLat; zoom?: number; ring?: boolean } | null>(null)
  const [sel, go] = useHashSelection()
  const [alertSettings, setAlertSettings] = useAlertSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [vehicleModes, setVehicleModes] = useState<VehicleMode[]>(['train', 'bus', 'tram', 'ferry'])
  const [vehicleFilter, setVehicleFilter] = useState<{ title: string; match: (code: string) => boolean } | null>(null)
  const [followVehicle, setFollowVehicle] = useState(false)
  const [fit, setFit] = useState<{ bounds: Bounds; id: number } | null>(null)

  const transitOpen = panel === 'transit' || !!sel.transit
  const { vehicles: allVehicles, error: vehicleError } = useLiveVehicles(
    layers.vehicles || !!sel.vehicle || sel.transit?.kind === 'line' || sel.transit?.kind === 'stop',
  )
  const { alerts: transitAlerts, error: transitAlertsError } = useTransitAlerts(
    transitOpen || !!sel.vehicle || alertSettings.routes.length > 0,
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

  const selectedPlace = useMemo((): Place | null => {
    const p = sel.place
    if (!p) return null
    if (p.kind === 'rest') {
      const data = ref.restAreas.find((r) => r.id === p.id)
      return data ? { kind: 'rest', data } : null
    }
    if (p.kind === 'dump') {
      const data = ref.dumpPoints.find((d) => d.id === p.id)
      return data ? { kind: 'dump', data } : null
    }
    if (p.kind === 'truck') {
      const data = ref.truckRestrictions.find((t) => String(t.properties.id) === p.id)
      return data ? { kind: 'truck', data } : null
    }
    if (p.kind === 'waze') {
      const data = waze.find((w) => w.uuid === p.id)
      return data ? { kind: 'waze', data } : null
    }
    return null
  }, [sel.place, ref, waze])

  // Opening a shared link to a layer item turns that layer on.
  useEffect(() => {
    const k = sel.place?.kind
    const key = k === 'rest' ? 'restAreas' : k === 'dump' ? 'dumpPoints' : k === 'truck' ? 'trucks' : k === 'waze' ? 'waze' : null
    if (key) setLayers((l) => (l[key] ? l : { ...l, [key]: true }))
  }, [sel.place?.kind])

  useEffect(() => {
    if (!selectedPlace) {
      if (!sel.vehicle) setFocus(null)
      return
    }
    const at =
      selectedPlace.kind === 'waze'
        ? ([selectedPlace.data.location.x, selectedPlace.data.location.y] as LngLat)
        : selectedPlace.kind === 'truck'
          ? (selectedPlace.data.geometry.coordinates[0]?.[0] as LngLat)
          : selectedPlace.data.coordinates
    if (at) setFocus({ center: at, zoom: selectedPlace.kind === 'truck' ? 12 : 13 })
  }, [selectedPlace, sel.vehicle])

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

  const stats = useMemo(() => {
    const current = events.filter((e) => !isUpcoming(e, now))
    return {
      current: current.length,
      closures: current.filter(isClosure).length,
      crashes: current.filter((e) => e.properties.event_type === 'Crash').length,
      redAlerts: current.filter((e) => e.properties.event_priority === 'Red Alert').length,
    }
  }, [events, now])

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
    }),
    [cameras, ref, waze, fires, gauges, signalVolumes],
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

  const sidebar = selectedEvent ? (
    <EventDetail
      event={selectedEvent}
      cameras={cameras}
      now={now}
      onBack={() => go('')}
      onOpenCamera={(k) => openKey(`camera/${k}`)}
      watched={alertSettings.watchedEvents.includes(selectedEvent.properties.id)}
      onToggleWatch={() => notifications.toggleWatchEvent(selectedEvent.properties.id)}
      gauges={gauges}
      onOpenHref={openHref}
    />
  ) : sel.vehicle ? (
    !allVehicles.length && !vehicleError ? (
      <div className="flex justify-center py-16">
        <Loader />
      </div>
    ) : (
      <VehicleDetail
        vehicle={selectedVehicle}
        alerts={transitAlerts}
        watchedRoutes={alertSettings.routes}
        now={now}
        onBack={() => go('')}
        onToggleWatch={notifications.toggleWatchRoute}
        onOpenAlert={(id) => openHref(`transit/alert/${encodeURIComponent(id)}`)}
        onOpenHref={openHref}
        following={followVehicle}
        onToggleFollow={() => {
          setFollowVehicle((f) => !f)
          revealMap()
        }}
      />
    )
  ) : selectedPlace ? (
    <PlaceDetail place={selectedPlace} now={now} onBack={() => go('')} />
  ) : selectedFire ? (
    <FireDetail fire={selectedFire} now={now} onBack={() => go('')} />
  ) : selectedGauge ? (
    <GaugeDetail gauge={selectedGauge} now={now} onBack={() => (history.length > 1 ? history.back() : go(''))} />
  ) : selectedSignal ? (
    <SignalDetail site={selectedSignal} approaches={signalVolumes?.get(selectedSignal.tsc) ?? null} now={now} onBack={() => go('')} />
  ) : (
    <>
      <div className="px-4 pt-3">
        <Tabs
          // Three tabs always fit; Kumo's scroll arrow can still appear from sub-pixel rounding.
          className="w-full [&_button[aria-label^='Scroll_tabs']]:hidden"
          listClassName="w-full [&>*]:flex-1"
          value={transitOpen ? 'transit' : panel}
          onValueChange={(v) => {
            setPanel(v as Panel)
            if (sel.transit) go('')
          }}
          tabs={[
            { value: 'events', label: 'Road events' },
            { value: 'cameras', label: 'Cameras' },
            { value: 'transit', label: 'Transit' },
          ]}
        />
      </div>
      {transitOpen ? (
        <TransitPanel
          view={sel.transit ?? { kind: 'home' }}
          alerts={transitAlerts}
          alertsError={transitAlertsError}
          vehicles={allVehicles}
          watchedRoutes={alertSettings.routes}
          onNavigate={openHref}
          onToggleWatch={notifications.toggleWatchRoute}
          onShowOnMap={showLineOnMap}
          mapView={mapView}
          onShowMap={() => revealMap()}
        />
      ) : panel === 'events' ? (
        <EventList
          allEvents={events}
          events={visible}
          districts={districts}
          filters={filters}
          onFiltersChange={setFilters}
          loading={loading}
          now={now}
          userLocation={userLocation}
          locating={locating}
          onLocate={locate}
          onSelect={selectEvent}
          fires={fires}
          onOpenHref={openHref}
        />
      ) : panel === 'cameras' ? (
        <CameraGrid cameras={cameras} selectedKey={sel.camera} onOpen={(k) => openKey(`camera/${k}`)} />
      ) : null}
    </>
  )

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-kumo-canvas">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-kumo-line bg-kumo-base px-4">
          <a href="#" onClick={(e) => (e.preventDefault(), go(''))} className="flex min-w-0 items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-7" />
            <div className="grid leading-tight">
              <Text variant="heading" as="h1">
                Roadbeat
              </Text>
              <span className="hidden text-xs text-kumo-subtle sm:block">Live roads and transport across Queensland</span>
            </div>
          </a>

          <nav aria-label="Quick filters" className="hidden min-w-0 items-center gap-1.5 md:flex">
            {(
              [
                {
                  key: 'all',
                  label: 'Current events',
                  value: firstLoad ? null : stats.current,
                  icon: TrafficConeIcon,
                  active: panel === 'events' && !transitOpen && filters.when === 'now' && !filtersActive(filters),
                  apply: () => showEvents(() => ({ ...DEFAULT_FILTERS, sort: filters.sort })),
                },
                {
                  key: 'closures',
                  label: 'Closures',
                  value: firstLoad ? null : stats.closures,
                  icon: ProhibitIcon,
                  tone: 'danger',
                  active: panel === 'events' && filters.closuresOnly,
                  apply: () => showEvents((f) => ({ ...f, when: 'now', closuresOnly: !f.closuresOnly })),
                },
                {
                  key: 'crashes',
                  label: 'Crashes',
                  value: firstLoad ? null : stats.crashes,
                  icon: CarProfileIcon,
                  tone: 'danger',
                  active: panel === 'events' && filters.types.size === 1 && filters.types.has('Crash'),
                  apply: () =>
                    showEvents((f) => ({
                      ...f,
                      when: 'now',
                      types: f.types.size === 1 && f.types.has('Crash') ? new Set() : new Set(['Crash' as const]),
                    })),
                },
                {
                  key: 'red',
                  label: 'Red alerts',
                  value: firstLoad ? null : stats.redAlerts,
                  icon: SirenIcon,
                  tone: 'danger',
                  active: panel === 'events' && filters.priority === 'Red Alert',
                  apply: () => showEvents((f) => ({ ...f, when: 'now', priority: f.priority === 'Red Alert' ? 'all' : 'Red Alert' })),
                },
                {
                  key: 'cameras',
                  label: 'Cameras',
                  value: firstLoad ? null : cameras.length,
                  icon: VideoCameraIcon,
                  active: panel === 'cameras' && !transitOpen,
                  apply: () => {
                    setPanel('cameras')
                    revealList()
                    if (sel.transit) go('')
                  },
                },
              ] satisfies (StatChipProps & { key: string })[]
            ).map(({ key, ...chip }) => (
              <StatChip key={key} {...chip} />
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <InstallApp />
            <NotificationCenter
              items={notifications.items}
              unread={notifications.unread}
              now={now}
              onOpen={(n) => {
                notifications.markRead(n.id)
                if (n.href) openHref(n.href)
              }}
              onMarkAllRead={notifications.markAllRead}
              onClear={notifications.clear}
              onSettings={() => setSettingsOpen(true)}
            />
            <span className="mr-1 hidden items-center gap-1.5 text-sm text-kumo-subtle sm:flex" aria-live="polite">
              <span className={`size-2 rounded-full ${error ? 'bg-kumo-danger' : 'bg-kumo-success'}`} aria-hidden />
              {fetchedAt ? `Updated ${timeAgo(fetchedAt, now)}` : 'Connecting…'}
            </span>
            <Tooltip
              content="Refresh now"
              render={
                <Button
                  variant="ghost"
                  shape="square"
                  aria-label="Refresh events"
                  icon={<ArrowClockwiseIcon />}
                  loading={refreshing && !loading}
                  onClick={refresh}
                />
              }
            />
            <Tooltip
              content={mode === 'dark' ? 'Light mode' : 'Dark mode'}
              render={
                <Button
                  variant="ghost"
                  shape="square"
                  aria-label="Toggle colour mode"
                  icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />}
                  onClick={toggle}
                />
              }
            />
          </div>
        </header>

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
            <div className={`flex min-h-0 w-full flex-1 flex-col ${panelMode === 'expanded' ? 'md:mx-auto md:max-w-5xl' : ''}`}>{sidebar}</div>
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

interface StatChipProps {
  label: string
  /** Null while the first load is in progress, so "0" never stands in for "not loaded yet". */
  value: number | null
  icon: Icon
  tone?: 'danger'
  active: boolean
  apply: () => void
}

/**
 * A header count that is also a shortcut: it shows the live number and, when
 * clicked, opens the list filtered to it (click again to clear).
 */
function StatChip({ label, value, icon: I, tone, active, apply }: StatChipProps) {
  const alert = tone === 'danger' && value != null && value > 0
  return (
    <button
      type="button"
      onClick={apply}
      aria-pressed={active}
      title={active ? `Showing ${label.toLowerCase()} — click to clear` : `Show ${label.toLowerCase()}`}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-left ring ${
        active ? 'bg-kumo-tint ring-kumo-brand' : 'ring-kumo-line hover:bg-kumo-tint'
      }`}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-full ${alert ? 'bg-kumo-danger/10 text-kumo-danger' : 'bg-kumo-recessed text-kumo-subtle'}`}
        aria-hidden
      >
        <I size={14} weight="bold" />
      </span>
      <span className={`text-sm font-semibold tabular-nums ${alert ? 'text-kumo-danger' : value == null ? 'text-kumo-subtle' : 'text-kumo-strong'}`}>
        {value ?? '…'}
      </span>
      <span className="hidden text-sm text-kumo-subtle xl:inline">{label}</span>
      <span className="sr-only xl:hidden">{label}</span>
    </button>
  )
}

/** Whether any list filter besides sorting is set. */
function filtersActive(f: EventFilters) {
  return !!f.query || f.types.size > 0 || f.district !== 'all' || f.priority !== 'all' || f.closuresOnly
}
