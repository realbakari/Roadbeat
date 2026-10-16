import { Badge, Banner, Button, Empty, InputGroup, Loader, Tabs, Text } from '@cloudflare/kumo'
import {
  ArrowLeftIcon,
  BellIcon,
  BellRingingIcon,
  BoatIcon,
  BusIcon,
  MagnifyingGlassIcon,
  MapTrifoldIcon,
  TrainIcon,
  TramIcon,
  WifiSlashIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { alertActive, alertNextStart, allRouteCodes, routeInfo, routeLabel, type LiveVehicle, type TransitAlert } from '../api/translink'
import { readableTextOn } from '../lib/routeColor'
import type { TransitLine, TransitMode, TransitNotice } from '../api/types'
import { planHash, routeHref, type TransitView } from '../lib/route'
import { useNow, useTransit, useTransitAlerts } from '../hooks/useTrafficData'
import { isTransitRegion } from '../api/transitTypes'
import { MAIN_REGIONS } from '../lib/transitRegions'
import { RoutePage } from './RoutePage'
import { RegionalRoutesDirectory } from './RegionalRoutes'
import { LineDepartures, StopPage } from './Departures'
import { JourneyPlanner } from './JourneyPlanner'
import { LineTimetable, TimetableLink } from './Timetable'
import { DeparturesHome, ModeChips, TransitSearch } from './TransitHome'
import { TransitMapsDirectory } from './TransitMaps'
import { TripPage } from './TripPage'
import { AlertCards, ExternalLink, Section } from './TransitParts'
import { alertsForCodes, lineMatcher, lineSlug, lineWatchKey, routeLabels, vehiclesForCodes } from '../lib/transitLines'

const MODES: { mode: TransitMode; label: string; icon: Icon }[] = [
  { mode: 'train', label: 'Trains', icon: TrainIcon },
  { mode: 'bus', label: 'Buses', icon: BusIcon },
  { mode: 'ferry', label: 'Ferries', icon: BoatIcon },
  { mode: 'tram', label: 'Trams', icon: TramIcon },
]
const MODE_ICON: Record<TransitMode, Icon> = { train: TrainIcon, bus: BusIcon, ferry: BoatIcon, tram: TramIcon }

const when = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Brisbane',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

function statusBadge(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const s = status.toLowerCase()
  return s === 'normal' ? 'success' : s === 'major' ? 'error' : s === 'minor' ? 'warning' : 'neutral'
}

interface Props {
  view: TransitView
  alerts: TransitAlert[] | null
  alertsError: string | null
  vehicles: LiveVehicle[]
  watchedRoutes: string[]
  onNavigate: (hash: string) => void
  onToggleWatch: (route: string) => void
  onShowOnMap: (title: string, match: (code: string) => boolean) => void
  /** The map's current centre and zoom, for "stops near the map centre". */
  mapView: { center: [number, number]; zoom: number } | null
  /** Switches to the map on small screens. */
  onShowMap: () => void
}

/** TransLink network status, live service alerts and per-line pages. */
export function TransitPanel(props: Props) {
  const { data, error } = useTransit(true)
  const { view, alerts } = props
  // Alerts are ids like "TSV-123"; outside SEQ and Cairns they're read only while their page is open.
  const alertRegion = view.kind === 'alert' ? view.id.split('-')[0] : undefined
  const regional = isTransitRegion(alertRegion) && !MAIN_REGIONS.includes(alertRegion) ? alertRegion : undefined
  const regionalAlerts = useTransitAlerts(!!regional, regional)

  if (view.kind === 'line') {
    const line = data?.lines.find((l) => l.mode === view.mode && l.name === view.name)
    if (!data) return <Centered>{error ? <Offline /> : <Loader />}</Centered>
    if (!line) return <BackOnly onBack={() => props.onNavigate('transit')} />
    return <LinePage line={line} {...props} />
  }
  if (view.kind === 'route') {
    return <RoutePage region={view.region} code={view.code} alerts={alerts} vehicles={props.vehicles} onNavigate={props.onNavigate} onShowOnMap={props.onShowOnMap} />
  }
  if (view.kind === 'stop') {
    return <StopPage region={view.region} id={view.id} vehicles={props.vehicles} alerts={alerts} onNavigate={props.onNavigate} />
  }
  if (view.kind === 'trip') {
    return <TripPage region={view.region} tripId={view.tripId} route={view.route} date={view.date} vehicles={props.vehicles} onNavigate={props.onNavigate} />
  }
  if (view.kind === 'alert') {
    const list = regional ? regionalAlerts.alerts : alerts
    const a = list?.find((x) => x.id === view.id)
    if (!list) return <Centered>{(regional ? regionalAlerts.error : props.alertsError) ? <Offline /> : <Loader />}</Centered>
    if (!a) return <BackOnly onBack={() => props.onNavigate('transit')} />
    return <AlertPage alert={a} {...props} />
  }
  return <Home data={data} error={error} {...props} />
}

type HomeTab = 'plan' | 'departures' | 'lines' | 'alerts'

/**
 * Transit home, organised like transportnsw.info's "Plan your trip" panel and
 * Transport Victoria's home: one tab per thing people come to do.
 */
function Home({
  view,
  data,
  error,
  alerts,
  alertsError,
  vehicles,
  mapView,
  onShowMap,
  onShowOnMap,
  onNavigate,
}: Props & { data: { lines: TransitLine[]; notices: TransitNotice[] } | null; error: boolean }) {
  const plan = view.kind === 'home' ? view.plan : undefined
  const [tab, setTab] = useState<HomeTab>(() => (plan ? 'plan' : ((sessionGet('qldt-transit-tab') as HomeTab | null) ?? 'plan')))
  // A shared or saved trip link opens the planner.
  const [planKey, setPlanKey] = useState(plan)
  if (plan !== planKey) {
    setPlanKey(plan)
    if (plan) setTab('plan')
  }
  const choose = (t: HomeTab) => {
    setTab(t)
    sessionSet('qldt-transit-tab', t)
  }
  const [query, setQuery] = useState('')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-kumo-line px-4 pt-3 pb-3">
        <Tabs
          variant="underline"
          className="w-full"
          listClassName="w-full [&>*]:flex-1"
          value={tab}
          onValueChange={(v) => choose(v as HomeTab)}
          tabs={[
            { value: 'plan', label: 'Planner' },
            { value: 'departures', label: 'Departures' },
            { value: 'lines', label: 'Lines' },
            { value: 'alerts', label: alerts ? `Alerts ${alerts.length}` : 'Alerts' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {tab === 'plan' ? (
          <JourneyPlanner
            key={plan ? planHash(plan) : 'new'}
            vehicles={vehicles}
            alerts={alerts}
            initial={plan}
            onNavigate={onNavigate}
          />
        ) : tab === 'departures' ? (
          <>
            <div className="grid gap-1 px-4 pt-4">
              <Text size="sm" variant="secondary">
                Find a station or stop to see its next departures, live, and its full timetable.
              </Text>
              <TransitSearch lines={data?.lines ?? null} query={query} onQuery={setQuery} onNavigate={onNavigate} />
            </div>
            {!query.trim() && <DeparturesHome mapView={mapView} vehicles={vehicles} alerts={alerts} onShowMap={onShowMap} onNavigate={onNavigate} />}
          </>
        ) : tab === 'lines' ? (
          <div className="grid gap-6 pb-6">
            {!data ? (
              <Centered>{error ? <Offline /> : <Loader />}</Centered>
            ) : (
              <Lines lines={data.lines} onOpen={(l) => onNavigate(`transit/line/${lineSlug(l)}`)} onShowOnMap={onShowOnMap} />
            )}
            <RegionalRoutesDirectory onNavigate={onNavigate} />
          </div>
        ) : alerts ? (
          <AlertList alerts={alerts} onOpen={(a) => onNavigate(`transit/alert/${encodeURIComponent(a.id)}`)} />
        ) : alertsError ? (
          // Without the TransLink proxy (e.g. a plain static host), fall back to the RSS notices.
          data ? <Notices notices={data.notices} /> : <Centered><Offline /></Centered>
        ) : (
          <Centered>
            <Loader />
          </Centered>
        )}
        {tab === 'alerts' && (
          <div className="px-4 py-4">
            <ExternalLink href="https://translink.com.au/service-updates">All TransLink service updates</ExternalLink>
          </div>
        )}
      </div>
    </div>
  )
}

function sessionGet(k: string) {
  try {
    return sessionStorage.getItem(k)
  } catch {
    return null
  }
}
function sessionSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v)
  } catch {
    // Storage blocked: the tab just won't be remembered.
  }
}

/** "Lines & timetables": search plus mode chips over TransLink's status lines. */

function Lines({
  lines,
  onOpen,
  onShowOnMap,
}: {
  lines: TransitLine[]
  onOpen: (l: TransitLine) => void
  onShowOnMap: Props['onShowOnMap']
}) {
  const [mode, setMode] = useState<TransitMode | 'all'>('all')
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const list = lines.filter((l) => (mode === 'all' || l.mode === mode) && (!needle || l.name.toLowerCase().includes(needle)))
  return (
    <div className="grid gap-3 pt-4">
      <div className="grid gap-2 px-4">
        <Text size="sm" variant="secondary">
          Open a line for its status, next departures, full timetable and live vehicles.
        </Text>
        <InputGroup>
          <InputGroup.Addon>
            <MagnifyingGlassIcon />
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Search lines" placeholder="Line name, e.g. Caboolture or F1" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <InputGroup.Button variant="ghost" shape="square" aria-label="Clear" icon={<XIcon />} onClick={() => setQ('')} />}
        </InputGroup>
        <ModeChips value={mode} onChange={setMode} />
      </div>
      {list.length ? <Status lines={list} onOpen={onOpen} /> : <div className="px-4"><Text variant="secondary">No lines match.</Text></div>}
      <section className="mx-4 grid gap-2 rounded-lg bg-kumo-recessed p-3">
        <Text bold>Network maps</Text>
        <Text size="sm" variant="secondary">
          See every train, tram and ferry line with its stations on the map; tap a station for its departures.
        </Text>
        <Button
          size="sm"
          className="justify-self-start"
          icon={<MapTrifoldIcon />}
          onClick={() => onShowOnMap('Train, tram and ferry network', (c) => (routeInfo(c)?.mode ?? 'bus') !== 'bus')}
        >
          Show network on map
        </Button>
      </section>
      <section className="mx-4 grid gap-2">
        <Text as="h3" variant="heading">
          Maps
        </Text>
        <Text size="sm" variant="secondary">
          Every printable map TransLink publishes, by place: network maps, busway maps, and station and locality maps.
        </Text>
        <TransitMapsDirectory />
      </section>
    </div>
  )
}

function Status({ lines, onOpen }: { lines: TransitLine[]; onOpen: (l: TransitLine) => void }) {
  return (
    <div className="grid gap-5 px-4">
      {MODES.map(({ mode, label, icon: I }) => {
        const list = lines.filter((l) => l.mode === mode)
        if (!list.length) return null
        const disrupted = list.filter((l) => l.status.toLowerCase() !== 'normal').length
        return (
          <section key={mode} className="grid gap-2">
            <div className="flex items-center gap-2">
              <I size={18} weight="fill" className="text-kumo-subtle" />
              <Text as="h3" variant="heading">
                {label}
              </Text>
              <Text size="sm" variant="secondary" as="span">
                {disrupted ? `${disrupted} of ${list.length} affected` : 'All running normally'}
              </Text>
            </div>
            <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
              {list.map((l) => (
                <li key={l.name}>
                  <button
                    type="button"
                    onClick={() => onOpen(l)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
                  >
                    <span className="min-w-0 truncate text-sm">{l.name}</span>
                    <Badge variant={statusBadge(l.status)} appearance="dot">
                      {l.status}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** A line's page, modelled on TransLink's timetable page: status, upcoming changes, next departures, live vehicles. */
function LinePage({ line, alerts, vehicles, watchedRoutes, onNavigate, onToggleWatch, onShowOnMap }: Props & { line: TransitLine }) {
  const match = useMemo(() => lineMatcher(line), [line])
  const watchKey = lineWatchKey(line)
  const watching = !!watchKey && watchedRoutes.some((r) => r.toLowerCase() === watchKey.toLowerCase())
  const now = useNow(60_000)
  const lineAlerts = match && alerts ? alertsForCodes(alerts, match) : []
  const current = lineAlerts.filter((a) => alertActive(a, now))
  const upcoming = lineAlerts
    .filter((a) => !alertActive(a, now) && alertNextStart(a, now))
    .sort((a, b) => alertNextStart(a, now)! - alertNextStart(b, now)!)
  const live = match ? vehiclesForCodes(vehicles, match) : []
  // Planned changes can run to a dozen; show the next two so departures stay near the top.
  const [allUpcoming, setAllUpcoming] = useState(false)
  const I = MODE_ICON[line.mode]
  // The line's official colour from TransLink's published route data, if any of its routes has one.
  const lineColor = useMemo(() => {
    const code = match ? allRouteCodes().find((c) => match(c) && routeInfo(c)?.color) : undefined
    return code ? (routeInfo(code)?.color ?? null) : null
  }, [match])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={() => onNavigate('transit')}>
          Network status
        </Button>
        {watchKey && (
          <Button
            variant={watching ? 'secondary' : 'ghost'}
            size="sm"
            icon={watching ? <BellRingingIcon weight="fill" /> : <BellIcon />}
            onClick={() => onToggleWatch(watchKey)}
          >
            {watching ? 'Watching' : 'Watch line'}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${lineColor ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
              style={lineColor ? { backgroundColor: lineColor, color: readableTextOn(lineColor) } : undefined}
              aria-hidden
            >
              <I size={22} weight="fill" />
            </span>
            <div className="grid min-w-0 gap-1">
              <Text as="h2" variant="heading" size="lg">
                {line.name}
              </Text>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={statusBadge(line.status)} appearance="dot">
                  {line.status === 'Normal' ? 'Running normally' : `${line.status} disruption`}
                </Badge>
                {line.region && <Badge variant="outline">{line.region}</Badge>}
              </div>
              {match && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <TimetableLink target="line-timetable" />
                  <Button size="sm" variant="secondary" icon={<MapTrifoldIcon />} onClick={() => onShowOnMap(line.name, match)}>
                    Show on map
                  </Button>
                </div>
              )}
            </div>
          </header>

          {match ? (
            <>
              <Section title="Current status">
                {alerts ? (
                  current.length ? (
                    <AlertCards alerts={current} onOpen={(a) => onNavigate(`transit/alert/${encodeURIComponent(a.id)}`)} />
                  ) : (
                    <Text variant="secondary">No current disruptions reported.</Text>
                  )
                ) : (
                  <Loader size="sm" />
                )}
              </Section>
              <Section title="Upcoming changes">
                {alerts ? (
                  upcoming.length ? (
                    <>
                      <AlertCards
                        alerts={allUpcoming ? upcoming : upcoming.slice(0, 2)}
                        onOpen={(a) => onNavigate(`transit/alert/${encodeURIComponent(a.id)}`)}
                      />
                      {upcoming.length > 2 && (
                        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setAllUpcoming((v) => !v)}>
                          {allUpcoming ? 'Show fewer' : `Show ${upcoming.length - 2} more planned changes`}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Text variant="secondary">No planned changes listed.</Text>
                  )
                ) : (
                  <Loader size="sm" />
                )}
              </Section>
              <Section title="Next departures">
                <LineDepartures match={match} mode={line.mode} vehicles={vehicles} onNavigate={onNavigate} />
              </Section>
              <Section title="Timetable" id="line-timetable">
                <LineTimetable match={match} mode={line.mode} vehicles={vehicles} onNavigate={onNavigate} />
              </Section>
              <Section title="Live">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-kumo-recessed px-3 py-2.5">
                  <Text>
                    <span className="font-medium tabular-nums">{live.length}</span>{' '}
                    {line.mode === 'train' ? 'trains' : line.mode === 'ferry' ? 'ferries' : 'services'} on this line right now
                  </Text>
                  <Button size="sm" icon={<MapTrifoldIcon />} disabled={!live.length} onClick={() => onShowOnMap(line.name, match)}>
                    Show on map
                  </Button>
                </div>
              </Section>
            </>
          ) : (
            <Banner
              variant="secondary"
              size="sm"
              description="This status line doesn't match a route in TransLink's published timetable data, so live alerts and vehicles aren't linked here. See the timetable for details."
            />
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <ExternalLink href={line.link}>Timetable on TransLink</ExternalLink>
            <ExternalLink href="https://jp.translink.com.au/plan-your-journey">Plan a journey</ExternalLink>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertPage({ alert: a, onNavigate, watchedRoutes, onToggleWatch }: Props & { alert: TransitAlert }) {
  const now = useNow(60_000)
  const active = alertActive(a, now)
  const upcomingPeriods = a.periods.filter((p) => p.end == null || p.end > now).slice(0, 8)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={() => history.back()}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-5 px-4 pt-4 pb-8">
          <header className="grid gap-2">
            <Text as="h2" variant="heading" size="lg">
              {a.header}
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={active ? 'warning' : 'neutral'} appearance="dot">
                {active ? 'In effect now' : 'Upcoming'}
              </Badge>
              <Badge variant="outline">{a.effect}</Badge>
              <Badge variant="outline">{a.cause}</Badge>
            </div>
          </header>
          {a.description && <Text>{a.description}</Text>}
          {upcomingPeriods.length > 0 && (
            <Section title="When">
              <ul className="grid gap-1">
                {upcomingPeriods.map((p, i) => (
                  <li key={i} className="text-sm">
                    {p.start ? when.format(p.start) : 'Now'} → {p.end ? when.format(p.end) : 'until further notice'}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {a.routes.length > 0 && !MAIN_REGIONS.includes(a.region) && (
            // Route alerts are watched across SEQ and Cairns only, so a regional route links to its page instead.
            <Section title={`Affected routes (${a.routes.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {a.routes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onNavigate(routeHref(a.region, code))}
                    className="rounded-md px-2 py-0.5 text-sm ring ring-kumo-line hover:bg-kumo-tint"
                  >
                    {routeLabel(code, a.region)}
                  </button>
                ))}
              </div>
            </Section>
          )}
          {a.routes.length > 0 && MAIN_REGIONS.includes(a.region) && (
            <Section title={`Affected routes (${routeLabels(a).length})`}>
              <div className="flex flex-wrap gap-1.5">
                {routeLabels(a).map((r) => {
                  const on = watchedRoutes.some((w) => w.toLowerCase() === r.toLowerCase())
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onToggleWatch(r)}
                      title={on ? 'Stop watching' : 'Watch this route'}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm ring ${on ? 'bg-kumo-tint ring-kumo-brand' : 'ring-kumo-line hover:bg-kumo-tint'}`}
                    >
                      {on && <BellRingingIcon size={12} weight="fill" />}
                      {r}
                    </button>
                  )
                })}
              </div>
              <Text size="xs" variant="secondary">
                Tap a route to get alerts about it.
              </Text>
            </Section>
          )}
          <div className="flex gap-4">
            {a.url && <ExternalLink href={a.url}>Details on TransLink</ExternalLink>}
            <button type="button" className="text-sm text-kumo-link hover:underline" onClick={() => onNavigate('transit')}>
              All alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertList({ alerts, onOpen }: { alerts: TransitAlert[]; onOpen: (a: TransitAlert) => void }) {
  const [when, setWhen] = useState<'now' | 'upcoming'>('now')
  const [q, setQ] = useState('')
  const now = useNow(60_000)
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return alerts
      .filter((a) => (when === 'now' ? alertActive(a, now) : !alertActive(a, now) && alertNextStart(a, now) != null))
      .filter(
        (a) =>
          !needle ||
          a.header.toLowerCase().includes(needle) ||
          a.routes.some((r) => r.toLowerCase() === needle || routeLabel(r).toLowerCase().includes(needle)),
      )
      .sort((a, b) => (when === 'upcoming' ? (alertNextStart(a, now) ?? 0) - (alertNextStart(b, now) ?? 0) : 0))
  }, [alerts, when, q, now])

  return (
    <div className="grid gap-3 pt-3">
      <div className="grid gap-2 px-4">
        <InputGroup>
          <InputGroup.Addon>
            <MagnifyingGlassIcon />
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Search alerts" placeholder="Route, station or stop" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <InputGroup.Button variant="ghost" shape="square" aria-label="Clear" icon={<XIcon />} onClick={() => setQ('')} />}
        </InputGroup>
        <Tabs
          size="sm"
          value={when}
          onValueChange={(v) => setWhen(v as 'now' | 'upcoming')}
          tabs={[
            { value: 'now', label: 'In effect now' },
            { value: 'upcoming', label: 'Upcoming' },
          ]}
        />
      </div>
      {list.length ? (
        <div className="px-4">
          <AlertCards alerts={list} onOpen={onOpen} />
        </div>
      ) : (
        <div className="px-4 py-8">
          <Empty size="sm" title="No alerts" description={q ? 'Nothing matches that search.' : 'Nothing reported here right now.'} />
        </div>
      )}
    </div>
  )
}

function Notices({ notices }: { notices: TransitNotice[] }) {
  return (
    <ul className="divide-y divide-kumo-line border-t border-kumo-line">
      {notices
        .filter((n) => !n.upcoming)
        .map((n) => (
          <li key={n.link + n.title}>
            <a href={n.link} target="_blank" rel="noreferrer" className="grid gap-1 px-4 py-3 hover:bg-kumo-tint">
              <Text bold>{n.title}</Text>
              <Text size="sm" variant="secondary">
                {n.description.replace(/,\s*$/, '')}
              </Text>
            </a>
          </li>
        ))}
    </ul>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 justify-center px-4 py-16">{children}</div>
}

function Offline() {
  return (
    <Empty
      size="sm"
      icon={<WifiSlashIcon size={32} className="text-kumo-inactive" />}
      title="Couldn't reach TransLink"
      description="Trying again shortly."
    />
  )
}

function BackOnly({ onBack }: { onBack: () => void }) {
  return (
    <div className="grid gap-4 px-4 py-6">
      <Text variant="secondary">This item is no longer listed.</Text>
      <Button size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
        Back to transit
      </Button>
    </div>
  )
}
