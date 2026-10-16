import { Button, Empty, InputGroup, Loader, Text } from '@cloudflare/kumo'
import {
  ArrowSquareOutIcon,
  BoatIcon,
  BusIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NavigationArrowIcon,
  StarIcon,
  TrainIcon,
  TramIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Stop, StopIndex } from '../api/stops'
import { routesAtStops, type TimetableIndex } from '../api/timetables'
import { routeInfo, routeLabel, type LiveVehicle, type TransitAlert, type TransitRegion } from '../api/translink'
import type { TransitLine, TransitMode } from '../api/types'
import { useNow, useStopIndex, useTimetableIndex, useTripIndex, useTripUpdates } from '../hooks/useTrafficData'
import { distanceKm } from '../lib/geo'
import { searchStops } from '../lib/planner'
import { clearRecentStops, useRecentStops, useSavedStops } from '../lib/savedStops'
import { departuresAt, stopHref, type Departure } from '../lib/departures'
import { minutesUntil } from '../lib/timeFormat'
import { DelayChip } from './Realtime'
import { SavedTrips } from './SavedTrips'
import { lineMatcher, lineSlug } from '../lib/transitLines'
import { readableTextOn } from '../lib/routeColor'
import { REGION_NAMES } from '../lib/transitRegions'
import { regionalRoutes, searchRoutes } from '../lib/regionalRoutes'
import { RouteRows } from './RegionalRoutes'

const clockTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })

const MODE_ICON: Record<string, Icon> = { train: TrainIcon, bus: BusIcon, ferry: BoatIcon, tram: TramIcon }

/** Routes calling at a stop (or any platform of a station), from TransLink's published timetable. */
function stopRoutes(idx: TimetableIndex | null, stops: StopIndex, stop: Stop) {
  if (!idx) return []
  const codes = routesAtStops(idx, stop.region, [stop.id, ...stops.children(stop).map((c) => c.id)])
  const seen = new Map<string, { label: string; color: string | null; mode: string }>()
  for (const c of codes) {
    const r = routeInfo(c, stop.region)
    const label = r?.line?.split(' ')[0] ?? r?.short ?? c
    if (!seen.has(label)) seen.set(label, { label, color: r?.color ?? null, mode: r?.mode ?? 'bus' })
  }
  const rank = (m: string) => ['train', 'tram', 'ferry'].indexOf(m) >>> 0 // rail, tram and ferry before buses
  return [...seen.values()].sort((a, b) => rank(a.mode) - rank(b.mode) || a.label.localeCompare(b.label, 'en', { numeric: true }))
}

export function RouteBadges({ routes, max = 6 }: { routes: ReturnType<typeof stopRoutes>; max?: number }) {
  if (!routes.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {routes.slice(0, max).map((r) => (
        <span
          key={r.label}
          className={`rounded px-1.5 text-xs leading-5 font-semibold ${r.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
          style={r.color ? { backgroundColor: r.color, color: readableTextOn(r.color) } : undefined}
        >
          {r.label}
        </span>
      ))}
      {routes.length > max && <span className="text-xs leading-5 text-kumo-subtle">+{routes.length - max}</span>}
    </span>
  )
}

export function StopRow({
  stop,
  stops,
  idx,
  detail,
  preview,
  now,
  onNavigate,
}: {
  stop: Stop
  stops: StopIndex
  idx: TimetableIndex | null
  detail?: string
  /** Next departures from the real-time feed, previewed as on the TransLink app's Explore screen. */
  preview?: Departure[] | null
  now?: number
  onNavigate: (hash: string) => void
}) {
  const routes = stopRoutes(idx, stops, stop)
  const I = MODE_ICON[routes.find((r) => r.mode !== 'bus')?.mode ?? 'bus']
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(stopHref(stop.region, stop.id))}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
      >
        <I size={18} weight="fill" className="shrink-0 text-kumo-subtle" />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-sm">
            {stop.name}
            {stop.region !== 'SEQ' && <span className="text-kumo-subtle"> · {REGION_NAMES[stop.region]}</span>}
          </span>
          <RouteBadges routes={routes} />
          {preview && now != null && (
            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-kumo-subtle tabular-nums">
              {preview.length ? (
                preview.map((d) => (
                  <span key={d.key} className="inline-flex items-center gap-1">
                    <span className={`size-1.5 rounded-full ${d.vehicle ? 'bg-kumo-success' : 'ring-1 ring-kumo-line ring-inset'}`} />
                    <span className="font-medium text-kumo-default">{routeLabel(d.trip.route, d.trip.region).split(' ')[0]}</span>
                    {minutesUntil(d.time, now) ?? clockTime.format(d.time)}
                    {d.delay != null && (d.vehicle || Math.abs(d.delay) >= 60) && <DelayChip delay={d.delay} />}
                  </span>
                ))
              ) : (
                <span>No departures in the real-time feed right now</span>
              )}
            </span>
          )}
        </span>
        {detail && <span className="shrink-0 text-sm text-kumo-subtle tabular-nums">{detail}</span>}
        <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" />
      </button>
    </li>
  )
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * The search box at the top of Transit, like the journey planners on
 * TransLink, Transport Victoria and transportnsw.info: one place to find a
 * station, stop or line.
 */
export function TransitSearch({
  lines,
  query,
  onQuery,
  onNavigate,
}: {
  lines: TransitLine[] | null
  query: string
  onQuery: (q: string) => void
  onNavigate: (hash: string) => void
}) {
  const q = norm(query)
  const stops = useStopIndex(q.length >= 2, q.length >= 3)
  const { index } = useTimetableIndex(q.length >= 2)

  const lineHits = useMemo(() => {
    if (!q || !lines) return []
    return lines
      .filter((l) => {
        if (norm(l.name).includes(q)) return true
        const m = /^[a-z]?\d+[a-z]?$/.test(q) ? lineMatcher(l) : null
        return !!m && m(q.toUpperCase())
      })
      .slice(0, 5)
  }, [q, lines])

  const stopHits = useMemo(() => (stops ? searchStops(stops, q) : []), [q, stops])
  const routes = useMemo(() => (index ? regionalRoutes(index, routeInfo) : null), [index])
  const routeHits = useMemo(() => (routes ? searchRoutes(routes, q) : []), [q, routes])

  return (
    <div className="grid gap-2">
      <InputGroup>
        <InputGroup.Addon>
          <MagnifyingGlassIcon />
        </InputGroup.Addon>
        <InputGroup.Input
          aria-label="Search stations, stops and lines"
          placeholder="Station, stop, line or route number"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && <InputGroup.Button variant="ghost" shape="square" aria-label="Clear" icon={<XIcon />} onClick={() => onQuery('')} />}
      </InputGroup>
      {q.length >= 2 && (
        <div className="grid gap-3">
          {lineHits.length > 0 && (
            <ResultGroup title="Lines">
              {lineHits.map((l) => {
                const I = MODE_ICON[l.mode]
                return (
                  <li key={l.mode + l.name}>
                    <button
                      type="button"
                      onClick={() => onNavigate(`transit/line/${lineSlug(l)}`)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
                    >
                      <I size={18} weight="fill" className="shrink-0 text-kumo-subtle" />
                      <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                      <span className="shrink-0 text-xs text-kumo-subtle">Timetable & status</span>
                      <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" />
                    </button>
                  </li>
                )
              })}
            </ResultGroup>
          )}
          {routeHits.length > 0 && (
            <section className="grid gap-1.5">
              <Text size="xs" variant="secondary" bold>
                Regional routes
              </Text>
              <RouteRows routes={routeHits} showRegion onNavigate={onNavigate} />
            </section>
          )}
          {!stops ? (
            <Loader size="sm" />
          ) : stopHits.length > 0 ? (
            <ResultGroup title="Stations and stops">
              {stopHits.map((s) => (
                <StopRow key={s.region + s.id} stop={s} stops={stops} idx={index} onNavigate={onNavigate} />
              ))}
            </ResultGroup>
          ) : (
            !lineHits.length &&
            !routeHits.length && (
              <Text variant="secondary">
                Nothing matches “{query.trim()}”. Try a station or suburb name, a stop number, or a route like 66 or T1.
              </Text>
            )
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <Text size="xs" variant="secondary" bold>
        {title}
      </Text>
      <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">{children}</ul>
    </section>
  )
}

type Nearby =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'failed'; message: string }
  | { state: 'ok'; at: [number, number]; source: 'you' | 'map' }

/** Why the browser couldn't give a location, and what to do about it. */
function locationError(e: GeolocationPositionError | null) {
  if (!window.isSecureContext) return 'Location needs a secure (https) connection.'
  if (!e) return "This browser doesn't support location."
  if (e.code === e.PERMISSION_DENIED)
    return "Location is blocked for this site. Allow it in your browser's site settings (the icon beside the address), then try again."
  if (e.code === e.TIMEOUT) return 'Finding your location took too long.'
  return "Your device couldn't work out where you are."
}

/** Map view below this zoom covers too much ground for "near the map centre" to mean anything. */
const MAP_MIN_ZOOM = 12

/** "Departures" tab: saved trips and stops, stops near you, and a way into the journey planner. */
export function DeparturesHome({
  mapView,
  vehicles,
  alerts,
  onShowMap,
  onNavigate,
}: {
  mapView: { center: [number, number]; zoom: number } | null
  vehicles: LiveVehicle[]
  alerts: TransitAlert[] | null
  onShowMap: () => void
  onNavigate: (hash: string) => void
}) {
  const saved = useSavedStops()
  const recentAll = useRecentStops()
  // Recently opened stops that aren't already saved.
  const recent = recentAll.filter((r) => !saved.some((s) => s.region === r.region && s.id === r.id))
  const [near, setNear] = useState<Nearby>({ state: 'idle' })
  const needStops = saved.length > 0 || recent.length > 0 || near.state === 'ok'
  const stops = useStopIndex(needStops, near.state === 'ok' || [...saved, ...recent].some((s) => /^\d+$/.test(s.id)))
  const { index } = useTimetableIndex(needStops)
  // Next departures for each listed stop, from the real-time feed.
  const { updates } = useTripUpdates(needStops)
  const tripIndex = useTripIndex(needStops)
  const now = useNow(15_000)
  const preview = (s: Stop) =>
    updates && stops
      ? departuresAt({ updates, vehicles, trips: tripIndex, now }, s.region, new Set([s.id, ...stops.children(s).map((c) => c.id)]), 3)
      : null

  const locate = () => {
    if (!navigator.geolocation || !window.isSecureContext) return setNear({ state: 'failed', message: locationError(null) })
    setNear({ state: 'locating' })
    const ask = (highAccuracy: boolean) =>
      navigator.geolocation.getCurrentPosition(
        (p) => setNear({ state: 'ok', at: [p.coords.longitude, p.coords.latitude], source: 'you' }),
        // A slow or failed coarse fix gets one more try with GPS; a block doesn't.
        (e) =>
          !highAccuracy && e.code !== e.PERMISSION_DENIED ? ask(true) : setNear({ state: 'failed', message: locationError(e) }),
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 20_000 : 10_000, maximumAge: 120_000 },
      )
    ask(false)
  }
  const mapUsable = !!mapView && mapView.zoom >= MAP_MIN_ZOOM
  const useMap = () => mapView && setNear({ state: 'ok', at: mapView.center, source: 'map' })

  const nearby = useMemo(() => {
    if (near.state !== 'ok' || !stops) return null
    const list: { s: Stop; km: number }[] = []
    for (const s of stops.all()) {
      if (s.parent) continue
      const km = distanceKm(near.at, s.position)
      if (km <= 1.5) list.push({ s, km })
    }
    return list.sort((a, b) => a.km - b.km).slice(0, 10)
  }, [near, stops])

  return (
    <div className="grid gap-5 px-4 pt-4">
      <SavedTrips vehicles={vehicles} alerts={alerts} onNavigate={onNavigate} hint="Save a trip in the Planner to see its next departures here." />

      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <StarIcon size={18} weight="fill" className="text-kumo-subtle" />
          <Text as="h3" variant="heading">
            My stops
          </Text>
        </div>
        {!saved.length ? (
          <Text size="sm" variant="secondary">
            Save a stop with the star on its page to see it here.
          </Text>
        ) : !stops ? (
          <Loader size="sm" />
        ) : (
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {saved.map((x) => {
              const s = stops.get(x.region as TransitRegion, x.id)
              return s ? (
                <StopRow key={x.region + x.id} stop={s} stops={stops} idx={index} preview={preview(s)} now={now} onNavigate={onNavigate} />
              ) : null
            })}
          </ul>
        )}
      </section>

      {recent.length > 0 && stops && (
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClockCounterClockwiseIcon size={18} weight="bold" className="text-kumo-subtle" />
              <Text as="h3" variant="heading">
                Recent
              </Text>
            </div>
            <button type="button" className="text-sm text-kumo-link hover:underline" onClick={clearRecentStops}>
              Clear
            </button>
          </div>
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {recent.map((x) => {
              const s = stops.get(x.region, x.id)
              return s ? (
                <StopRow key={x.region + x.id} stop={s} stops={stops} idx={index} preview={preview(s)} now={now} onNavigate={onNavigate} />
              ) : null
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <MapPinIcon size={18} weight="fill" className="text-kumo-subtle" />
          <Text as="h3" variant="heading">
            Near me
          </Text>
        </div>
        {near.state === 'ok' && (
          <Text size="sm" variant="secondary">
            {near.source === 'you' ? 'Closest to you' : 'Closest to the centre of the map'}, within 1.5 km.
          </Text>
        )}
        {near.state === 'ok' ? (
          !nearby ? (
            <Loader size="sm" />
          ) : nearby.length ? (
            <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
              {nearby.map(({ s, km }) => (
                <StopRow
                  key={s.region + s.id}
                  stop={s}
                  stops={stops!}
                  idx={index}
                  detail={km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`}
                  preview={preview(s)}
                  now={now}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          ) : (
            <Empty size="sm" title="No stops within 1.5 km" description="Search for a station or stop above instead." />
          )
        ) : (
          <Text size="sm" variant="secondary">
            {near.state === 'failed'
              ? near.message
              : 'Shows the closest stations and stops with the routes that use them. Your location stays on this device.'}
          </Text>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<NavigationArrowIcon />} loading={near.state === 'locating'} onClick={locate}>
            {near.state === 'failed' ? 'Try again' : near.state === 'ok' && near.source === 'you' ? 'Update' : 'Find stops near me'}
          </Button>
          <Button size="sm" variant="secondary" icon={<MapPinIcon />} disabled={!mapUsable} onClick={useMap}>
            {near.state === 'ok' && near.source === 'map' ? 'Update from map' : 'Near the map centre'}
          </Button>
        </div>
        {!mapUsable && (
          <Text size="xs" variant="secondary">
            No location? Zoom the map in on an area, then use “Near the map centre”.{' '}
            <button type="button" className="text-kumo-link hover:underline md:hidden" onClick={onShowMap}>
              Open the map
            </button>
          </Text>
        )}
      </section>

      <section className="grid gap-2 rounded-lg bg-kumo-recessed p-3">
        <Text bold>Going somewhere?</Text>
        <Text size="sm" variant="secondary">
          Open a stop for its next departures and full timetable, or plan a door-to-door trip in TransLink's journey planner.
        </Text>
        <a
          href="https://jp.translink.com.au/plan-your-journey/journey-planner"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline"
        >
          Plan a journey on TransLink <ArrowSquareOutIcon size={14} />
        </a>
      </section>
    </div>
  )
}

const LINE_MODES: { mode: TransitMode; label: string }[] = [
  { mode: 'train', label: 'Train' },
  { mode: 'bus', label: 'Bus' },
  { mode: 'ferry', label: 'Ferry' },
  { mode: 'tram', label: 'Tram' },
]

/** Mode chips for the Lines tab, as on Transport Victoria's departures page. */
export function ModeChips({ value, onChange }: { value: TransitMode | 'all'; onChange: (m: TransitMode | 'all') => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Mode">
      {[{ mode: 'all' as const, label: 'All' }, ...LINE_MODES].map(({ mode, label }) => {
        const I = mode === 'all' ? null : MODE_ICON[mode]
        const on = value === mode
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(mode)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring ${on ? 'bg-kumo-tint ring-kumo-brand' : 'text-kumo-subtle ring-kumo-line hover:bg-kumo-tint'}`}
          >
            {I && <I size={14} weight="fill" />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
