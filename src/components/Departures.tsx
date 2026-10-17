import { Badge, Button, Empty, Loader, Tabs, Text } from '@cloudflare/kumo'
import {
  ArrowLeftIcon,
  BroadcastIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CaretUpIcon,
  MonitorIcon,
  StarIcon,
  WarningIcon,
  WifiSlashIcon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import type { Stop, StopIndex } from '../api/stops'
import { alertActive, isAccessibilityAlert, routeInfo, routeLabel, type LiveVehicle, type TransitAlert, type TransitRegion } from '../api/translink'
import { brisbaneDate, routesAtStops } from '../api/timetables'
import { useTripsOn } from '../hooks/useTimetable'
import { useNow, useStopIndex, useTimetableIndex, useTransitAlerts, useTripIndex, useTripUpdates } from '../hooks/useTrafficData'
import { useRealtimeState } from '../hooks/useRegionFeeds'
import { MAIN_REGIONS, REGION_NAMES, type RealtimeState } from '../lib/transitRegions'
import { regionRoutes } from '../lib/regionalRoutes'
import { RouteRows } from './RegionalRoutes'
import { scheduledDepartures, type ScheduledDeparture } from '../lib/timetable'
import { overdueMinutes, reportingTrips, timetableTripHref, tripHref, type FeedWatch } from '../lib/trip'
import { timetableCodes } from '../lib/transitLines'
import { recordRecentStop, toggleSavedStop, useSavedStops } from '../lib/savedStops'
import { DelayChip, TimeFormatToggle } from './Realtime'
import { StationMapLink } from './TransitMaps'
import { AccessAlerts, BusStopSection, FerryTerminalSection, StationFacilitiesSection } from './StationAccess'
import { StopTimetable, TimetableLink } from './Timetable'
import { NextService } from './NextService'
import { minutesUntil, useTimeFormat } from '../lib/timeFormat'
import { kioskPath } from '../lib/route'
import { departuresAt, lineDirections, stopHref, type Departure, type DepartureContext } from '../lib/departures'
import { regionRead } from '../lib/tripFeed'
import { readableTextOn } from '../lib/routeColor'
import { NewTabNote } from './NewTabNote'

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })

function dueIn(t: number, now: number) {
  const m = Math.round((t - now) / 60_000)
  return m <= 0 ? 'Now' : m < 60 ? `${m} min` : null
}

/**
 * A departure time the way the TransLink app shows it: the scheduled time with
 * the reported delay beside it ("+3", "+0"). In compact rows, minutes to go.
 */
function Time({ d, now, compact }: { d: Departure; now: number; compact?: boolean }) {
  const [format] = useTimeFormat()
  const due = dueIn(d.time, now)
  // "+0" only means something when a vehicle is tracked; an untracked trip shows a delay only if one is reported.
  const showDelay = d.delay != null && (d.vehicle != null || Math.abs(d.delay) >= 60)
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span
        className={`size-2 shrink-0 self-center rounded-full ${d.vehicle ? 'bg-kumo-success' : 'ring-2 ring-kumo-line ring-inset'}`}
        title={d.vehicle ? 'Real-time: vehicle is reporting its position' : 'Scheduled: vehicle not tracked yet'}
        aria-label={d.vehicle ? 'Real-time' : 'Scheduled'}
      />
      {compact ? (
        <span className={`font-medium ${showDelay && Math.round(d.delay! / 60) !== 0 ? 'text-kumo-danger' : ''}`}>
          {due ?? clock.format(d.time)}
        </span>
      ) : (
        <>
          <span className="font-medium">{(format === 'minutes' && minutesUntil(d.time, now)) || clock.format(d.scheduled ?? d.time)}</span>
          {showDelay && <DelayChip delay={d.delay} />}
        </>
      )}
    </span>
  )
}

function Legend() {
  return (
    <Text size="xs" variant="secondary">
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-full bg-kumo-success" /> Real-time
      </span>{' '}
      — a vehicle on that trip is reporting its position.{' '}
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-full ring-2 ring-kumo-line ring-inset" /> Scheduled
      </span>{' '}
      — not tracked yet. Countdowns run to the reported time. Clock times are scheduled, with the reported delay beside them as in the
      TransLink app:{' '}
      <span className="rounded bg-kumo-success/15 px-1 font-semibold text-kumo-success">+0</span> on time,{' '}
      <span className="rounded bg-kumo-danger/10 px-1 font-semibold text-kumo-danger">+3</span> minutes late or early.
      TransLink's real-time feed covers services running now or starting soon; the published timetable is below.
      “Due … min past, no vehicle reporting” means a timetabled departure has passed, no vehicle reports that trip, and
      TransLink's real-time feed hasn't listed it at any point while this page has been checking since before the trip
      started. It isn't a cancellation: only TransLink's feed marks a trip cancelled.
      Tap a service to see its stops.
    </Text>
  )
}

function useDepartureContext(vehicles: LiveVehicle[]) {
  const { updates, watch, error } = useTripUpdates(true)
  const trips = useTripIndex(true)
  const now = useNow(15_000)
  const ctx: DepartureContext | null = useMemo(
    () => (updates ? { updates, vehicles, trips, now } : null),
    [updates, vehicles, trips, now],
  )
  return { ctx, watch, error, now }
}

function FeedError() {
  return (
    <Empty
      size="sm"
      icon={<WifiSlashIcon size={32} className="text-kumo-inactive" />}
      title="Couldn't load real-time departures"
      description="Trying again shortly."
    />
  )
}

/** "Next departures" on a line page: one tab per direction, each stop with its next services. */
export function LineDepartures({
  region = 'SEQ',
  match,
  mode,
  vehicles,
  onNavigate,
}: {
  region?: TransitRegion
  match: (code: string) => boolean
  mode: string
  vehicles: LiveVehicle[]
  onNavigate: (hash: string) => void
}) {
  const { ctx, error, now } = useDepartureContext(vehicles)
  const stops = useStopIndex(true, mode === 'bus')
  // Same routes as the line's timetable, so trains running through the line's terminus are listed too.
  const { index } = useTimetableIndex(true)
  const codes = useMemo(() => {
    const all = index?.regions[region]?.routes
    return all ? new Set(region === 'SEQ' ? timetableCodes(all.filter(match), index!, mode) : all.filter(match)) : null
  }, [index, region, match, mode])
  const dirs = useMemo(
    () =>
      ctx && ctx.trips
        ? lineDirections(ctx, stops, (code, r) => r === region && (codes ? codes.has(code) : match(code)))
        : null,
    [ctx, stops, region, match, codes],
  )
  const [tab, setTab] = useState(0)

  if (!dirs) return error ? <FeedError /> : <Loader size="sm" />
  if (!dirs.length) return <Text variant="secondary">No services on this line in TransLink's real-time feed right now.</Text>
  const dir = dirs[Math.min(tab, dirs.length - 1)]

  return (
    <div className="grid gap-3">
      {dirs.length > 1 && (
        <Tabs
          size="sm"
          value={String(Math.min(tab, dirs.length - 1))}
          onValueChange={(v) => setTab(Number(v))}
          tabs={dirs.map((d, i) => ({ value: String(i), label: d.headsigns[0] ? `To ${shortName(d.headsigns[0])}` : 'Extra services' }))}
        />
      )}
      <Text size="sm" variant="secondary">
        {dir.headsigns.length
          ? `Services to ${dir.headsigns.map(shortName).join(', ')}`
          : "Services that aren't in TransLink's published timetable (such as extra trips), so no destination is listed."}
      </Text>
      <ol className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
        {dir.stops.map((s) => (
          <li key={s.region + s.id} className="flex items-center justify-between gap-3 px-3 py-1">
            <button
              type="button"
              onClick={() => onNavigate(stopHref(s.region, s.id))}
              className="min-w-0 truncate py-1 text-left text-sm hover:underline"
            >
              {s.name ?? `Stop ${s.id}`}
            </button>
            <span className="flex shrink-0 gap-1 text-sm">
              {s.departures.length ? (
                s.departures.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    title="This service's stops"
                    onClick={() => onNavigate(tripHref(d.trip.region, d.trip.tripId, d.trip.route))}
                    className="rounded px-1.5 py-1 hover:bg-kumo-tint"
                  >
                    <Time d={d} now={now} compact />
                  </button>
                ))
              ) : (
                <span className="text-kumo-subtle">—</span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <Legend />
    </div>
  )
}

/** In place of next departures where TransLink's real-time feed has nothing for the region. */
export function TimetableOnly({ region, state }: { region: TransitRegion; state: Exclude<RealtimeState, 'live'> }) {
  if (state === 'checking') return <Loader size="sm" />
  return (
    <div className="grid gap-1">
      <Badge variant="outline" className="w-fit">
        Timetable only
      </Badge>
      <Text variant="secondary">
        TransLink isn't publishing real-time information for {REGION_NAMES[region]} right now, so there are no live times here. The
        published timetable is below.
      </Text>
    </div>
  )
}

/** "Caboolture station" → "Caboolture" for tab labels. */
function shortName(headsign: string) {
  return headsign.replace(/ station$/i, '')
}

/** A stop or station with its upcoming departures across every route. */
export function StopPage({
  region,
  id,
  vehicles,
  alerts: mainAlerts,
  onNavigate,
}: {
  region: TransitRegion
  id: string
  vehicles: LiveVehicle[]
  /** TransLink service alerts for SEQ and Cairns, or null while loading. */
  alerts: TransitAlert[] | null
  onNavigate: (hash: string) => void
}) {
  const stops = useStopIndex(true, true)
  const { ctx, watch, error, now } = useDepartureContext(vehicles)
  const realtime = useRealtimeState(region)
  const main = MAIN_REGIONS.includes(region)
  // Other regions' alerts are read only while one of their stops is open.
  const own = useTransitAlerts(!main, region)
  const alerts = main ? mainAlerts : own.alerts
  const stop = stops?.get(region, id) ?? null
  const ids = useMemo(() => (stop && stops ? stopIds(stops, stop) : new Set([id])), [stops, stop, id])
  const list = useMemo(() => (ctx && realtime === 'live' && regionRead(ctx.updates, region) ? departuresAt(ctx, region, ids) : null), [ctx, realtime, region, ids])
  const nextService = list?.find((d) => d.trip.relationship !== 'cancelled') ?? null
  const overdueAll = useOverdue(region, ids, ctx, watch, vehicles)
  const overdue = realtime === 'live' ? overdueAll : []
  useEffect(() => {
    if (stop) recordRecentStop({ region, id: stop.id })
  }, [region, stop])
  const { index } = useTimetableIndex(true)
  const routes = useMemo(() => (index ? routesAtStops(index, region, ids) : null), [index, region, ids])
  // Lift and escalator outages TransLink reports for this stop or its platforms.
  const accessAlerts = useMemo(
    () => (alerts ?? []).filter((a) => a.region === region && alertActive(a, now) && isAccessibilityAlert(a) && a.stopIds.some((s) => ids.has(s))),
    [alerts, region, now, ids],
  )
  // Alerts in effect now on any route that calls here, or naming this stop or its platforms.
  const stopAlerts = useMemo(() => {
    if (!alerts || !routes) return null
    const on = new Set(routes)
    // Lift and escalator outages show in the station's access section instead.
    return alerts.filter(
      (a) =>
        a.region === region &&
        alertActive(a, now) &&
        !isAccessibilityAlert(a) &&
        (a.routes.some((r) => on.has(r)) || a.stopIds.some((s) => ids.has(s))),
    )
  }, [alerts, routes, region, now, ids])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={() => history.back()}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-5 px-4 pt-4 pb-8">
          {!stops ? (
            <Loader />
          ) : !stop ? (
            <Text variant="secondary">This stop isn't in TransLink's published stop list.</Text>
          ) : (
            <header className="grid gap-1">
              <Text as="h2" variant="heading" size="lg">
                {stop.name}
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {stop.parent && stops.get(region, stop.parent) && (
                  <button
                    type="button"
                    className="text-sm text-kumo-link hover:underline"
                    onClick={() => onNavigate(stopHref(region, stop.parent!))}
                  >
                    All of {stops.get(region, stop.parent)!.name}
                  </button>
                )}
                {!stop.parent && /^\d+$/.test(stop.id) && <Badge variant="outline">Stop {stop.id}</Badge>}
                {region !== 'SEQ' && <Badge variant="outline">{REGION_NAMES[region]}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <TimetableLink target="stop-timetable" />
                <SaveStopButton region={region} id={stop.id} />
                {main && <StationMapLink name={stops.station(stop).name} stopId={stops.station(stop).id} />}
                {/* The kiosk board lists real-time departures only. */}
                {realtime === 'live' && (
                  <a
                    href={kioskPath(region, stop.id)}
                    target="_blank"
                    rel="noreferrer"
                    title="A large departure board for a screen in a lobby or café"
                    className="inline-flex items-center gap-1 text-sm text-kumo-link underline decoration-1 underline-offset-2"
                  >
                    <MonitorIcon size={14} /> Kiosk display
                    <NewTabNote />
                  </a>
                )}
              </div>
            </header>
          )}

          <StopStats list={list} now={now} routes={routes} alerts={stopAlerts} region={region} realtime={realtime === 'live'} />

          <AccessAlerts alerts={accessAlerts} />

          {stopAlerts && stopAlerts.length > 0 && <StopAlerts alerts={stopAlerts} routes={routes} onNavigate={onNavigate} />}

          <section id="stop-next" className="grid scroll-mt-4 gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text as="h3" variant="heading">
                Next departures
              </Text>
              <TimeFormatToggle />
            </div>
            {realtime !== 'live' ? (
              <TimetableOnly region={region} state={realtime} />
            ) : !list ? (
              error ? (
                <FeedError />
              ) : (
                <Loader size="sm" />
              )
            ) : list.length || overdue.length ? (
              <>
                {nextService && <NextService d={nextService} now={now} stops={stops} onNavigate={onNavigate} />}
                {(overdue.length > 0 || list.length > 1) && (
                  <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
                    {overdue.map((o) => (
                      <OverdueRow key={o.d.key} d={o.d} minutes={o.minutes} since={o.since} stops={stops} onNavigate={onNavigate} />
                    ))}
                    {list
                      .filter((d) => d !== nextService)
                      .map((d) => (
                        <DepartureRow key={d.key} d={d} now={now} stops={stops} onNavigate={onNavigate} />
                      ))}
                  </ul>
                )}
              </>
            ) : (
              <Text variant="secondary">No departures from here in TransLink's real-time feed right now.</Text>
            )}
          </section>
          {realtime === 'live' && <Legend />}
          {/* SEQ lines have pages from TransLink's network status; elsewhere each route has its own. */}
          {region !== 'SEQ' && routes && routes.length > 0 && (
            <section className="grid gap-2">
              <Text as="h3" variant="heading">
                Routes
              </Text>
              <RouteRows routes={regionRoutes(region, routes, routeInfo)} onNavigate={onNavigate} />
            </section>
          )}
          {/* Facilities, terminal and bus stop records are SEQ datasets, keyed by TransLink's SEQ stop ids. */}
          {stop && region === 'SEQ' && <StationFacilitiesSection stopId={stops?.station(stop).id ?? stop.id} />}
          {stop && region === 'SEQ' && <FerryTerminalSection stopId={stop.id} />}
          {stop && region === 'SEQ' && <BusStopSection stopId={stop.id} />}
          <section id="stop-timetable" className="grid scroll-mt-4 gap-2">
            <Text as="h3" variant="heading">
              Timetable
            </Text>
            {stops && (
              <StopTimetable
                region={region}
                stopIds={ids}
                stops={stops}
                updates={ctx?.updates ?? null}
                vehicles={vehicles}
                now={now}
                onNavigate={onNavigate}
              />
            )}
          </section>
          {/^\d+$/.test(id) && (
            <a
              href={`https://translink.com.au/stop/${id.padStart(6, '0')}/gtfs/`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-kumo-link underline decoration-1 underline-offset-2"
            >
              Full timetable on TransLink
              <NewTabNote />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function SaveStopButton({ region, id }: { region: TransitRegion; id: string }) {
  const saved = useSavedStops().some((s) => s.region === region && s.id === id)
  return (
    <Button
      size="sm"
      variant={saved ? 'secondary' : 'ghost'}
      icon={<StarIcon weight={saved ? 'fill' : 'regular'} />}
      onClick={() => toggleSavedStop({ region, id })}
    >
      {saved ? 'Saved to My stops' : 'Save stop'}
    </Button>
  )
}

/**
 * Alerts on this stop's routes, collapsed to one line so the departures stay at
 * the top (TransLink's stop pages lead with departures too).
 */
function StopAlerts({
  alerts,
  routes,
  onNavigate,
}: {
  alerts: TransitAlert[]
  routes: string[] | null
  onNavigate: (hash: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <section id="stop-alerts" className="scroll-mt-4 overflow-hidden rounded-lg ring ring-kumo-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 bg-kumo-recessed px-3 py-2 text-left hover:bg-kumo-tint"
      >
        <span className="flex h-lh items-center text-kumo-warning">
          <WarningIcon size={16} weight="fill" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">
            {alerts.length === 1 ? '1 service alert' : `${alerts.length} service alerts`} on routes here
          </span>
          {!open && <span className="truncate text-xs text-kumo-subtle">{alerts[0].header}</span>}
        </span>
        <span className="flex h-lh items-center text-kumo-subtle">{open ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}</span>
      </button>
      {open && (
        <ul className="divide-y divide-kumo-line border-t border-kumo-line">
          {alerts.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onNavigate(`transit/alert/${encodeURIComponent(a.id)}`)}
                className="grid w-full gap-1 px-3 py-2 text-left hover:bg-kumo-tint"
              >
                <span className="text-sm font-medium">{a.header}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{a.effect}</Badge>
                  <Text size="xs" variant="secondary" as="span">
                    {[...new Set(a.routes.filter((r) => routes?.includes(r)).map((r) => routeLabel(r, a.region)))].join(', ')}
                  </Text>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * The stop at a glance, in the style of the header's counts: each number is
 * live from TransLink's feeds and jumps to the section it summarises.
 */
function StopStats({
  list,
  now,
  routes,
  alerts,
  region,
  realtime,
}: {
  list: Departure[] | null
  region: TransitRegion
  now: number
  routes: string[] | null
  alerts: TransitAlert[] | null
  /** False where the region has no real-time feed to count from: only the alert and route tiles show. */
  realtime: boolean
}) {
  const next = list?.find((d) => d.trip.relationship !== 'cancelled') ?? null
  const due = next ? (dueIn(next.time, now) ?? clock.format(next.time)) : list ? '—' : '…'
  const tracked = list?.filter((d) => d.vehicle).length ?? null
  const late = list?.filter((d) => d.trip.relationship === 'cancelled' || (d.delay ?? 0) >= 60).length ?? null
  const tiles: { label: string; value: string; tone?: 'danger' | 'warning' | 'success'; target: string; live?: boolean; fromFeed?: boolean; title: string }[] = [
    {
      label: next ? `Next · ${routeLabel(next.trip.route, next.trip.region).split(' ')[0]}` : 'Next',
      value: due,
      target: 'stop-next',
      live: !!next?.vehicle,
      fromFeed: true,
      title: next ? `${next.headsign ? `To ${next.headsign}` : 'Next service'} at ${clock.format(next.time)}` : 'Next departure',
    },
    { label: 'Tracked now', value: tracked == null ? '…' : String(tracked), tone: tracked ? 'success' : undefined, target: 'stop-next', fromFeed: true, title: 'Upcoming services whose vehicle is reporting its position' },
    { label: 'Late or cancelled', value: late == null ? '…' : String(late), tone: late ? 'warning' : undefined, target: 'stop-next', fromFeed: true, title: 'Upcoming services the real-time feed reports at least a minute late, or cancelled' },
    {
      label: 'Alerts',
      value: alerts == null ? '…' : String(alerts.length),
      tone: alerts?.length ? 'danger' : undefined,
      target: alerts?.length ? 'stop-alerts' : 'stop-next',
      title: 'TransLink service alerts in effect on routes that call here',
    },
    {
      label: 'Routes',
      // Riders count lines ("T1"), not Queensland Rail's origin–destination codes.
      value: routes == null ? '…' : String(new Set(routes.map((r) => routeLabel(r, region))).size),
      target: 'stop-timetable',
      title: 'Lines and routes in the published timetable that call here',
    },
  ]
  const TONE = { danger: 'text-kumo-danger', warning: 'text-kumo-warning', success: 'text-kumo-success' }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-kumo-line py-2.5">
      {tiles.filter((t) => realtime || !t.fromFeed).map((t) => (
        <button
          key={t.label}
          type="button"
          title={t.title}
          onClick={() => scrollToSection(t.target)}
          className="group grid text-left leading-tight focus-visible:rounded focus-visible:ring-2 focus-visible:ring-kumo-brand focus-visible:outline-none"
        >
          <span
            className={`flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap tabular-nums ${t.tone ? TONE[t.tone] : 'text-kumo-strong'}`}
          >
            {t.live && (
              <span className="size-2 shrink-0 rounded-full bg-kumo-success motion-safe:animate-pulse">
                <span className="sr-only">Real-time</span>
              </span>
            )}
            {t.value}
          </span>
          <span className="text-xs whitespace-nowrap text-kumo-subtle group-hover:text-kumo-default group-hover:underline">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

/** A stop plus, for a station, all of its platforms and stops. */
function stopIds(index: StopIndex, stop: Stop) {
  return new Set([stop.id, ...index.children(stop).map((c) => c.id)])
}

function DepartureRow({
  d,
  now,
  stops,
  onNavigate,
}: {
  d: Departure
  now: number
  stops: StopIndex | null
  onNavigate: (hash: string) => void
}) {
  const info = routeInfo(d.trip.route, d.trip.region)
  const platform = stops?.get(d.trip.region, d.stopId)?.platform
  const [format] = useTimeFormat()
  const due = dueIn(d.time, now)
  const body = (
    <>
      <span
        className={`flex h-6 min-w-10 shrink-0 items-center justify-center rounded px-1.5 text-xs font-semibold ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
        style={info?.color ? { backgroundColor: info.color, color: readableTextOn(info.color) } : undefined}
      >
        {info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm">{d.headsign ? `To ${d.headsign}` : (info?.long || routeLabel(d.trip.route, d.trip.region))}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-kumo-subtle">
          {platform && <span>Platform {platform}</span>}
          {d.vehicle ? (
            <span className="inline-flex items-center gap-1 text-kumo-success">
              <BroadcastIcon size={12} weight="bold" /> Real-time
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CalendarBlankIcon size={12} /> Scheduled
            </span>
          )}
          {d.trip.relationship === 'cancelled' && <span className="font-medium text-kumo-danger">Cancelled</span>}
          {d.trip.relationship === 'added' && <span>Extra service</span>}
        </span>
      </span>
      <span className="grid shrink-0 justify-items-end gap-0.5">
        <Time d={d} now={now} />
        <span className="text-xs text-kumo-subtle tabular-nums">
          {format === 'minutes' ? (minutesUntil(d.time, now) ? (d.scheduled != null ? `${clock.format(d.scheduled)} scheduled` : clock.format(d.time)) : '') : (due ?? '')}
        </span>
      </span>
    </>
  )
  return (
    <li>
      <button
        type="button"
        title="This service's stops"
        onClick={() => onNavigate(tripHref(d.trip.region, d.trip.tripId, d.trip.route))}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
      >
        {body}
      </button>
    </li>
  )
}

/**
 * Published departures from these stops that are past due with nothing in
 * TransLink's real-time feeds for them, latest first (see `overdueMinutes`).
 * Needs vehicle positions loaded, so an outage on our side never reads as a
 * missing vehicle.
 */
function useOverdue(region: TransitRegion, ids: Set<string>, ctx: DepartureContext | null, watch: FeedWatch | null, vehicles: LiveVehicle[]) {
  const { index } = useTimetableIndex(true)
  const today = ctx ? brisbaneDate(ctx.now) : null
  const codes = useMemo(() => (index ? routesAtStops(index, region, ids) : null), [index, region, ids])
  const trips = useTripsOn(region, codes, today, true)
  return useMemo(() => {
    if (!ctx || !trips || !vehicles.length) return []
    const reporting = reportingTrips(vehicles)
    return scheduledDepartures(trips, ids)
      .flatMap((d) => {
        const minutes = overdueMinutes(d, watch, reporting, ctx.now)
        return minutes == null ? [] : [{ d, minutes, since: watch!.since[region]! }]
      })
      .reverse()
  }, [ctx, trips, watch, vehicles, ids, region])
}

/** A published departure that is past due with no vehicle or real-time update reporting it, stated as just that. */
function OverdueRow({
  d,
  minutes,
  since,
  stops,
  onNavigate,
}: {
  d: ScheduledDeparture
  minutes: number
  /** When Roadbeat began watching the feed without a break. */
  since: number
  stops: StopIndex | null
  onNavigate: (hash: string) => void
}) {
  const info = routeInfo(d.trip.route, d.trip.region)
  const platform = stops?.get(d.trip.region, d.stop.stopId)?.platform
  return (
    <li>
      <button
        type="button"
        title={`TransLink's real-time feed hasn't listed this trip since Roadbeat began checking at ${clock.format(since)}. Tap for its stops.`}
        onClick={() => onNavigate(timetableTripHref(d.trip))}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
      >
        <span className="flex h-6 min-w-10 shrink-0 items-center justify-center rounded px-1.5 text-xs font-semibold ring ring-kumo-line">
          {info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm text-kumo-subtle">To {d.trip.headsign}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-kumo-warning">
            {platform && <span className="text-kumo-subtle">Platform {platform}</span>}
            <span>
              Due {clock.format(d.stop.time)} · {minutes} min past, no vehicle reporting
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}
