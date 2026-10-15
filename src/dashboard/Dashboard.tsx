import { Button } from '@cloudflare/kumo'
import { ArrowLeftIcon, ArrowsOutIcon, MoonIcon, SunIcon } from '@phosphor-icons/react'
import { useMemo, type ReactNode } from 'react'
import { FIRE_COLOR } from '../api/bushfires'
import { alertActive, isAccessibilityAlert, modeOf } from '../api/translink'
import { useColorMode } from '../hooks/useColorMode'
import { useBushfires, useCarParkSpaces, useGauges, useLiveVehicles, useNews, useNow, useSignals, useTrafficData, useTransitAlerts, useTripUpdates } from '../hooks/useTrafficData'
import { groupStories, headlineStories } from '../lib/newsStories'
import {
  busiestSignals,
  closuresAndCrashesByDistrict,
  currentEvents,
  fastestRising,
  firesByLevel,
  latestEvents,
  ON_TIME,
  corridorReport,
  footTraffic,
  punctuality,
  upcomingEvents,
} from '../lib/dashboard'
import { CORRIDORS_URL, EVENTS_URL, PEDESTRIANS_URL } from '../api/bccDashboard'
import { useCouncilDashboard } from './useCouncilDashboard'
import { isClosure } from '../lib/filters'
import { timeAgo } from '../lib/format'
import { dsColor } from '../lib/signals'
import { Ticker } from './Ticker'
import { WhatsHappening } from './WhatsHappening'
import { EmptyNote, Row, Stat, Tile } from './Tile'

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const timeOnly = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
const MODE_LABEL = { train: 'Trains', bus: 'Buses', tram: 'Trams', ferry: 'Ferries' } as const
const CRASH = '#dc2626'
const CLOSURE = '#7a1f3d'
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

/**
 * Full-screen network overview at /dashboard, for a TV or second monitor.
 * Every number is counted from an official feed; nothing is estimated.
 */
export function Dashboard() {
  const now = useNow(15_000)
  const { events, loading, fetchedAt, error } = useTrafficData()
  const { fires } = useBushfires(true)
  const { gauges } = useGauges(true)
  const { sites, volumes } = useSignals(true)
  const { updates } = useTripUpdates(true)
  const { vehicles } = useLiveVehicles(true)
  const { mode, toggle } = useColorMode()
  const { alerts } = useTransitAlerts(true)
  const parking = useCarParkSpaces(true)
  const council = useCouncilDashboard()
  const { snapshot: news } = useNews(true)
  const headlines = useMemo(() => (news ? headlineStories(groupStories(news.items), now) : null), [news, now])
  const corridorRows = useMemo(() => (council.corridors ? corridorReport(council.corridors.corridors, council.corridors.months) : null), [council.corridors])
  // Today's remaining timed events, or tomorrow's once today's are over.
  const todaysEvents = useMemo(() => {
    if (!council.events) return null
    const all = upcomingEvents(council.events, now, 100)
    const today = all.filter((e) => dayKey.format(e.start) === dayKey.format(now))
    return (today.length ? today : all).slice(0, 6)
  }, [council.events, now])
  const eventsTomorrow = !!todaysEvents?.length && dayKey.format(todaysEvents[0].start) !== dayKey.format(now)
  const foot = useMemo(() => (council.pedestrians ? footTraffic(council.pedestrians.hours) : null), [council.pedestrians])
  const liftOutages = useMemo(() => (alerts ?? []).filter((a) => isAccessibilityAlert(a) && alertActive(a, now)), [alerts, now])

  const current = useMemo(() => currentEvents(events, now), [events, now])
  const districts = useMemo(() => closuresAndCrashesByDistrict(events, now).slice(0, 7), [events, now])
  const ticker = useMemo(() => latestEvents(events, now, 20), [events, now])
  const transit = useMemo(
    () => (updates ? punctuality(updates, vehicles, now, (t) => modeOf(t.route, t.region)) : null),
    [updates, vehicles, now],
  )
  const fireLevels = useMemo(() => (fires ? firesByLevel(fires) : null), [fires])
  const rising = useMemo(() => (gauges ? fastestRising(gauges, 60 * 60_000, 6) : null), [gauges])
  const busy = useMemo(() => (sites && volumes ? busiestSignals(sites, volumes, 6) : null), [sites, volumes])

  const closures = current.filter(isClosure).length
  const crashes = current.filter((e) => e.properties.event_type === 'Crash').length
  const urgentFires = fires?.filter((f) => f.level === 'Emergency Warning' || f.level === 'Watch and Act').length
  const trains = transit?.find((t) => t.mode === 'train')
  const maxDistrict = Math.max(1, ...districts.map((d) => d.closures + d.crashes))

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-kumo-canvas p-4 xl:overflow-hidden xl:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href="/" className="flex items-center gap-2" title="Open the full app">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-lg font-semibold text-kumo-strong">Roadbeat</span>
        </a>
        <h1 className="text-lg text-kumo-subtle">Queensland network dashboard</h1>
        <span className="ml-auto flex items-center gap-3 text-sm text-kumo-subtle">
          <span className="flex items-center gap-1.5" aria-live="polite">
            <span className={`size-2 rounded-full ${error ? 'bg-kumo-danger' : 'bg-kumo-success'}`} aria-hidden />
            {error ? 'Road events delayed' : fetchedAt ? `Updated ${timeAgo(fetchedAt, now)}` : 'Connecting…'}
          </span>
          <span className="text-base font-medium text-kumo-strong tabular-nums">{clock.format(now)}</span>
          <Button variant="ghost" shape="square" aria-label="Back to the app" icon={<ArrowLeftIcon />} onClick={() => location.assign('/')} />
          <Button variant="ghost" shape="square" aria-label="Toggle colour mode" icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={toggle} />
          <Button
            variant="ghost"
            shape="square"
            aria-label="Full screen"
            icon={<ArrowsOutIcon />}
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
          />
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Road events in effect" value={loading ? '…' : current.length} href="/" />
        <Stat label="Road closures" value={loading ? '…' : closures} tone={CLOSURE} href="/" />
        <Stat label="Crashes" value={loading ? '…' : crashes} tone={CRASH} href="/" />
        <Stat label="Bushfire Emergency or Watch and Act" value={urgentFires ?? '…'} tone={urgentFires ? FIRE_COLOR['Watch and Act'] : undefined} />
        <Stat
          label="Tracked trains on time"
          value={trains?.tracked ? `${pct(trains.onTime, trains.tracked)}%` : '…'}
          tone="var(--color-kumo-success)"
          href="/#transit"
        />
        <Stat
          label={parking ? `Free in council CBD car parks: King George Sq ${parking.kingGeorgeSquare ?? '–'}, Wickham Tce ${parking.wickhamTerrace ?? '–'}` : 'Free in council CBD car parks'}
          value={parking ? (parking.kingGeorgeSquare ?? 0) + (parking.wickhamTerrace ?? 0) : '…'}
        />
      </div>

      <WhatsHappening stories={headlines} now={now} />

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
        <Tile title="Closures and crashes by district" source="QLDTraffic events in effect now.">
          {districts.length ? (
            <ul className="grid gap-1.5">
              {districts.map((d) => (
                <Row
                  key={d.district}
                  label={d.district}
                  value={
                    <span className="flex gap-3">
                      <span style={{ color: CLOSURE }}>{d.closures} closed</span>
                      <span style={{ color: CRASH }}>{d.crashes} crash{d.crashes === 1 ? '' : 'es'}</span>
                    </span>
                  }
                  bar={(d.closures + d.crashes) / maxDistrict}
                  color={d.crashes > d.closures ? CRASH : CLOSURE}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote>{loading ? 'Loading road events…' : 'No closures or crashes reported.'}</EmptyNote>
          )}
        </Tile>

        <Tile
          title="Public transport running"
          source={
            <>
              {liftOutages.length > 0 && (
                <span className="mb-1 block text-sm">
                  <span className="font-medium text-kumo-warning">
                    {liftOutages.length} lift or escalator {liftOutages.length === 1 ? 'outage' : 'outages'}:
                  </span>{' '}
                  <span className="text-kumo-subtle">{liftOutages.map((a) => a.header.replace(/^(lift|escalator) outage\s*-\s*/i, '')).join('; ')}</span>
                </span>
              )}
              {`TransLink real-time, trips with a vehicle reporting its position. On time: ${-ON_TIME.early / 60} min early to under ${ON_TIME.late / 60} min late, as reported. Not TransLink's official punctuality figure.`}
            </>
          }
        >
          {transit?.length ? (
            <ul className="grid gap-2.5">
              {transit.map((t) => (
                <li key={t.mode} className="grid gap-1">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{MODE_LABEL[t.mode]}</span>
                    <span className="tabular-nums text-kumo-subtle">
                      <span className="font-medium text-kumo-strong">{pct(t.onTime, t.tracked)}%</span> on time of {t.tracked} tracked
                      {t.cancelled > 0 && <span className="text-kumo-danger"> · {t.cancelled} cancelled</span>}
                    </span>
                  </span>
                  <span className="flex h-2.5 overflow-hidden rounded-full bg-kumo-tint" aria-hidden>
                    <span className="bg-kumo-success" style={{ width: `${pct(t.onTime, t.tracked)}%` }} />
                    <span className="bg-kumo-warning" style={{ width: `${pct(t.early, t.tracked)}%` }} />
                    <span className="bg-kumo-danger" style={{ width: `${pct(t.late, t.tracked)}%` }} />
                  </span>
                  <span className="flex gap-3 text-xs text-kumo-subtle tabular-nums">
                    <span>{t.onTime} on time</span>
                    <span>{t.late} late</span>
                    <span>{t.early} early</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>{transit ? 'No tracked services right now.' : 'Loading TransLink real-time…'}</EmptyNote>
          )}
        </Tile>

        <Tile title="Bushfire warnings" source="Queensland Fire Department current incidents and warnings.">
          {fireLevels ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                {fireLevels.map(({ level, count }) => (
                  <div key={level} className="grid gap-0.5 rounded-lg px-3 py-2 ring ring-kumo-line">
                    <span className="text-2xl font-semibold tabular-nums" style={{ color: count ? FIRE_COLOR[level] : undefined }}>
                      {count}
                    </span>
                    <span className="truncate text-xs text-kumo-subtle">{level}</span>
                  </div>
                ))}
              </div>
              <ul className="grid gap-0.5">
                {fires!.slice(0, 2).map((f) => (
                  <Row key={f.id} label={f.title} detail={f.level} value="" href={`/#fire/${encodeURIComponent(f.id)}`} />
                ))}
              </ul>
            </div>
          ) : (
            <EmptyNote>Loading bushfire warnings…</EmptyNote>
          )}
        </Tile>

        <Tile title="Brisbane creeks rising fastest" source="Brisbane City Council stream gauges, change over the last hour between reported readings. Heights only, not flood levels.">
          {rising?.length ? (
            <ul className="grid gap-1.5">
              {rising.map((r) => (
                <Row
                  key={r.gauge.id}
                  label={r.gauge.name}
                  detail={`${r.latest.toFixed(2)} m at ${timeOnly.format(r.at)}`}
                  value={<span className="text-kumo-danger">+{r.delta.toFixed(2)} m</span>}
                  href={`/#gauge/${encodeURIComponent(r.gauge.id)}`}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote>{rising ? 'No stream gauge has risen in the last hour.' : 'Loading gauges…'}</EmptyNote>
          )}
        </Tile>

        <Tile title="Busiest intersections" source="Brisbane City Council signals: the most saturated lane in each site's latest measured cycle.">
          {busy?.length ? (
            <ul className="grid gap-1.5">
              {busy.map((b) => (
                <Row
                  key={b.site.tsc}
                  label={b.site.streets.slice(0, 2).join(' & ') || `Signal ${b.site.tsc}`}
                  detail={b.site.suburb}
                  value={<span style={{ color: dsColor(b.maxDs) }}>{Math.round(b.maxDs)}%</span>}
                  bar={b.maxDs / 120}
                  color={dsColor(b.maxDs)}
                  href={`/#signal/${encodeURIComponent(b.site.tsc)}`}
                />
              ))}
            </ul>
          ) : (
            <EmptyNote>{busy ? 'No intersection data in the latest batch.' : 'Loading intersections…'}</EmptyNote>
          )}
        </Tile>

        <Tile title="Key corridor travel times" source={<CorridorSource report={corridorRows} />}>
          {corridorRows?.rows.length ? (
            <ul className="grid gap-1">
              {corridorRows.rows.slice(0, 7).map((r) => (
                <Row
                  key={r.name}
                  label={r.name}
                  detail={r.am != null ? `PM ${mmss(r.pm)}` : undefined}
                  value={
                    <span className="flex gap-2">
                      <span>AM {mmss(r.am)}</span>
                      {r.amChange != null && Math.abs(r.amChange) >= 5 && (
                        <span className={r.amChange > 0 ? 'text-kumo-danger' : 'text-kumo-success'}>
                          {r.amChange > 0 ? '+' : '−'}
                          {mmss(Math.abs(r.amChange))}
                        </span>
                      )}
                    </span>
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyNote>{council.corridors ? 'No corridor results published.' : 'Loading corridor results…'}</EmptyNote>
          )}
        </Tile>

        <Tile title={eventsTomorrow ? 'Council events tomorrow' : 'Council events today'} source={<SourceLink href={EVENTS_URL}>Brisbane City Council events. Timed events still to start; all-day listings left out.</SourceLink>}>
          {todaysEvents?.length ? (
            <ul className="grid gap-1">
              {todaysEvents.map((e) => (
                <Row key={`${e.title}-${e.start}`} label={e.title} detail={e.venue ?? undefined} value={<span className="text-kumo-subtle">{timeOnly.format(e.start)}</span>} href={e.url ?? undefined} />
              ))}
            </ul>
          ) : (
            <EmptyNote>{council.events ? 'No more timed council events today or tomorrow.' : 'Loading council events…'}</EmptyNote>
          )}
        </Tile>

        <Tile
          title="CBD foot traffic yesterday"
          source={
            <SourceLink href={PEDESTRIANS_URL}>
              Brisbane City Council sensors count movements across a line, not people. Hours the council estimated, or published as under 25, are left
              out.
            </SourceLink>
          }
        >
          {foot?.length ? (
            <ul className="grid gap-1.5">
              {foot.slice(0, 6).map((f) => (
                <Row
                  key={f.precinct}
                  label={f.precinct}
                  detail={f.measuredHours < f.hours ? `${f.measuredHours} of ${f.hours} sensor-hours measured` : undefined}
                  value={f.movements.toLocaleString('en-AU')}
                  bar={f.movements / Math.max(1, foot[0].movements)}
                  color="var(--color-kumo-brand)"
                />
              ))}
            </ul>
          ) : (
            <EmptyNote>{council.pedestrians ? 'No counts published for yesterday yet.' : 'Loading foot traffic…'}</EmptyNote>
          )}
        </Tile>
      </div>

      <Ticker events={ticker} now={now} />
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Seconds as m:ss. */
function mmss(sec: number | null) {
  if (sec == null) return '–'
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
      {children}
    </a>
  )
}

function CorridorSource({ report }: { report: ReturnType<typeof corridorReport> }) {
  return (
    <SourceLink href={CORRIDORS_URL}>
      Brisbane City Council measured averages{report ? ` for ${MONTHS[report.month - 1]} ${report.year}` : ''}: AM peak 7–9 am, PM peak 4–7 pm.
      Change is from the same month a year earlier.
    </SourceLink>
  )
}

