import { Loader, Tabs } from '@cloudflare/kumo'
import { MyPlaces } from './MyPlaces'
import type { Gauge } from '../api/bccGauges'
import type { RoadOccupancy } from '../api/bccRoadOccupancies'
import type { SignalSite, SignalVolumes } from '../api/bccSignals'
import type { FireWarning } from '../api/bushfires'
import type { FireBans } from '../api/fireBans'
import type { NewsPlace, NewsRoad, NewsSnapshot } from '../api/newsTypes'
import type { TransitAlert } from '../api/translink'
import type { LiveVehicle } from '../api/transitTypes'
import type { Camera, TrafficEvent } from '../api/types'
import type { useNotifications } from '../hooks/useNotifications'
import type { AlertSettings } from '../lib/alertRules'
import type { EventFilters } from '../lib/filters'
import type { LngLat, MapView } from '../lib/geo'
import type { Locality, LocalitySources } from '../lib/locality'
import type { NewsStory, StoryFilter } from '../lib/newsStories'
import type { Place } from '../lib/places'
import type { Selection } from '../lib/route'
import type { MapLayers } from './map/settings'
import { CameraGrid } from './CameraGrid'
import { CommuteCard } from './CommuteCard'
import { EventDetail } from './EventDetail'
import { EventList } from './EventList'
import { FireDetail } from './FireDetail'
import { GaugeDetail } from './GaugeDetail'
import { LocalityPage } from './LocalityPage'
import { NewsDetail } from './NewsDetail'
import { NewsPanel } from './NewsPanel'
import { PlaceDetail } from './PlaceDetail'
import { SignalDetail } from './SignalDetail'
import { TransitPanel } from './TransitPanel'
import { VehicleDetail } from './VehicleDetail'

/** The side panel's tabs, shown when no detail page is open. */
export type Panel = 'events' | 'cameras' | 'transit' | 'news'

interface Props {
  sel: Selection
  /** Changes the URL hash selection; '' closes the open page. */
  onNavigate: (hash: string) => void
  /** Opens an app hash from a link, switching to the panel it belongs to. */
  onOpenHref: (href: string) => void
  /** Opens a camera on the map, by its camera key. */
  onOpenCamera: (key: string) => void
  onSelectEvent: (id: number) => void
  onRevealMap: () => void
  now: number

  panel: Panel
  onPanelChange: (panel: Panel) => void
  transitOpen: boolean

  events: TrafficEvent[]
  /** When QLDTraffic's events were last read successfully, or null if never. */
  eventsAt: number | null
  eventsError: string | null
  visibleEvents: TrafficEvent[]
  selectedEvent: TrafficEvent | null
  districts: string[]
  filters: EventFilters
  onFiltersChange: (f: EventFilters) => void
  loading: boolean
  /** Why road events failed to load, while none has loaded yet; null otherwise. */
  loadError: string | null
  onRetry: () => unknown
  userLocation: LngLat | null
  locating: boolean
  onLocate: () => void
  occupancies: RoadOccupancy[] | null
  cameras: Camera[]

  vehicles: LiveVehicle[]
  vehicleError: string | null
  selectedVehicle: LiveVehicle | null
  followVehicle: boolean
  onToggleFollow: () => void
  transitAlerts: TransitAlert[] | null
  transitAlertsError: string | null
  onShowLineOnMap: (title: string, match: (code: string) => boolean) => void
  mapView: MapView | null

  selectedPlace: Place | null
  fires: FireWarning[] | null
  fireBans: FireBans | null
  /** Why the bushfire list is missing or stale, or null while the feed is fine. */
  fireNotice: string | null
  selectedFire: FireWarning | null
  gauges: Gauge[] | null
  /** Why gauges are missing or stale, or null while the feeds are fine. */
  gaugeNotice: string | null
  selectedGauge: Gauge | null
  selectedSignal: SignalSite | null
  signalVolumes: SignalVolumes | null

  news: { snapshot: NewsSnapshot | null; error: string | null; stories: NewsStory[] }
  newsFilter: StoryFilter
  onNewsFilterChange: (f: StoryFilter) => void
  selectedStory: NewsStory | null
  onShowNewsPlace: (p: NewsPlace) => void
  onShowNewsRoad: (r: NewsRoad) => void

  alertSettings: AlertSettings
  notifications: ReturnType<typeof useNotifications>

  /** The gazetteer locality #place/locality/<name> names, and what the loaded sources publish there. */
  locality: {
    found: Locality | null
    loading: boolean
    sources: LocalitySources
    onShowOnMap: (center: LngLat, layers: (keyof MapLayers)[]) => void
    onTurnOnLayer: (key: keyof MapLayers) => void
  }
}

/** The side panel: the open detail page if there is one, else the Road events, Cameras, Transit or News tab. */
export function SidePanel(p: Props) {
  const { sel, onNavigate, now, alertSettings, notifications } = p
  const back = () => onNavigate('')

  if (p.selectedEvent) {
    const id = p.selectedEvent.properties.id
    return (
      <EventDetail
        event={p.selectedEvent}
        cameras={p.cameras}
        now={now}
        onBack={back}
        onOpenCamera={p.onOpenCamera}
        watched={alertSettings.watchedEvents.includes(id)}
        onToggleWatch={() => notifications.toggleWatchEvent(id)}
        gauges={p.gauges}
        gaugeNotice={p.gaugeNotice}
        onOpenHref={p.onOpenHref}
      />
    )
  }
  if (sel.vehicle) {
    return !p.vehicles.length && !p.vehicleError ? (
      <div className="flex justify-center py-16">
        <Loader />
      </div>
    ) : (
      <VehicleDetail
        vehicle={p.selectedVehicle}
        alerts={p.transitAlerts}
        watchedRoutes={alertSettings.routes}
        now={now}
        onBack={back}
        onToggleWatch={notifications.toggleWatchRoute}
        onOpenAlert={(id) => p.onOpenHref(`transit/alert/${encodeURIComponent(id)}`)}
        onOpenHref={p.onOpenHref}
        following={p.followVehicle}
        onToggleFollow={p.onToggleFollow}
      />
    )
  }
  if (p.selectedPlace) return <PlaceDetail place={p.selectedPlace} now={now} onBack={back} onOpenHref={p.onOpenHref} />
  if (sel.locality) {
    return (
      <LocalityPage
        name={sel.locality}
        locality={p.locality.found}
        loading={p.locality.loading}
        sources={p.locality.sources}
        now={now}
        onBack={() => (history.length > 1 ? history.back() : onNavigate(''))}
        onOpenHref={p.onOpenHref}
        onOpenCamera={p.onOpenCamera}
        onShowOnMap={p.locality.onShowOnMap}
        onTurnOnLayer={p.locality.onTurnOnLayer}
      />
    )
  }
  if (p.selectedFire) return <FireDetail fire={p.selectedFire} now={now} onBack={back} />
  if (p.selectedGauge) {
    return <GaugeDetail gauge={p.selectedGauge} now={now} onBack={() => (history.length > 1 ? history.back() : onNavigate(''))} />
  }
  if (p.selectedStory) {
    return <NewsDetail story={p.selectedStory} now={now} onBack={() => onNavigate('news')} onShowPlace={p.onShowNewsPlace}
        onShowRoad={p.onShowNewsRoad}
        events={p.events}
        fires={p.fires}
        onOpenHref={p.onOpenHref}
      />
  }
  if (p.selectedSignal) {
    return (
      <SignalDetail site={p.selectedSignal} approaches={p.signalVolumes?.get(p.selectedSignal.tsc) ?? null} now={now} onBack={back} />
    )
  }

  return (
    <>
      <div className="px-4 pt-3">
        <Tabs
          // Four tabs always fit; Kumo's scroll arrow can still appear from sub-pixel rounding.
          className="w-full [&_button[aria-label^='Scroll_tabs']]:hidden"
          listClassName="w-full [&>*]:flex-1"
          value={p.transitOpen ? 'transit' : p.panel}
          onValueChange={(v) => {
            p.onPanelChange(v as Panel)
            if (sel.transit || sel.news != null) onNavigate('')
          }}
          tabs={[
            { value: 'events', label: 'Road events' },
            { value: 'cameras', label: 'Cameras' },
            { value: 'transit', label: 'Transit' },
            { value: 'news', label: 'News' },
          ]}
        />
      </div>
      {p.transitOpen ? (
        <TransitPanel
          view={sel.transit ?? { kind: 'home' }}
          alerts={p.transitAlerts}
          alertsError={p.transitAlertsError}
          vehicles={p.vehicles}
          watchedRoutes={alertSettings.routes}
          onNavigate={p.onOpenHref}
          onToggleWatch={notifications.toggleWatchRoute}
          onShowOnMap={p.onShowLineOnMap}
          mapView={p.mapView}
          onShowMap={() => p.onRevealMap()}
        />
      ) : p.panel === 'events' ? (
        <EventList
          allEvents={p.events}
          events={p.visibleEvents}
          districts={p.districts}
          filters={p.filters}
          onFiltersChange={p.onFiltersChange}
          loading={p.loading}
          loadError={p.loadError}
          onRetry={p.onRetry}
          now={now}
          userLocation={p.userLocation}
          locating={p.locating}
          onLocate={p.onLocate}
          onSelect={p.onSelectEvent}
          fires={p.fires}
          fireBans={p.fireBans}
          fireNotice={p.fireNotice}
          onOpenHref={p.onOpenHref}
          occupancies={p.occupancies}
          top={
            <>
              <CommuteCard events={p.events} eventsAt={p.eventsAt} eventsError={p.eventsError} fires={p.fires} vehicles={p.vehicles} alerts={p.transitAlerts} now={now} onOpen={p.onOpenHref} />
              <MyPlaces events={p.events} now={now} onOpen={p.onOpenHref} />
            </>
          }
        />
      ) : p.panel === 'cameras' ? (
        <CameraGrid cameras={p.cameras} selectedKey={sel.camera} onOpen={p.onOpenCamera} />
      ) : p.panel === 'news' ? (
        <NewsPanel
          snapshot={p.news.snapshot}
          error={p.news.error}
          stories={p.news.stories}
          filter={p.newsFilter}
          onFilterChange={p.onNewsFilterChange}
          now={now}
          onOpen={(id) => onNavigate(`news/${encodeURIComponent(id)}`)}
        />
      ) : null}
    </>
  )
}
