import { Button } from '@cloudflare/kumo'
import { ArrowLeftIcon, ArrowsOutIcon, MoonIcon, SlidersHorizontalIcon, SunIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { alertActive, isAccessibilityAlert, modeOf } from '../api/translink'
import { useColorMode } from '../hooks/useColorMode'
import { useAirQuality, useBushfires, useCarParkSpaces, useGauges, useLiveVehicles, useNews, useNow, useSignals, useTrafficData, useTransitAlerts, useTripUpdates } from '../hooks/useTrafficData'
import { busiestSignals, closuresAndCrashesByDistrict, currentEvents, fastestRising, firesByLevel, corridorReport, footTraffic, latestEvents, punctuality, upcomingEvents } from '../lib/dashboard'
import { initialLayout, LAYOUT_KEY, layoutQuery, panelsOf, type PanelId } from '../lib/dashboardLayout'
import { timeAgo } from '../lib/format'
import { groupStories, headlineStories } from '../lib/newsStories'
import { CustomiseDialog } from './CustomiseDialog'
import { PANEL_VIEWS, type DashboardData } from './panels'
import { MONITOR_VIEWS, type MonitorData } from './panelsMonitor'
import { Ticker } from './Ticker'
import { TimelineStrip } from './TimelineStrip'
import { useCouncilDashboard } from './useCouncilDashboard'
import { WhatsHappening } from './WhatsHappening'

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })

/** The layout, kept in this browser and in the page link as it changes. */
function useLayout() {
  const [layout, setLayout] = useState<PanelId[]>(() => initialLayout(location.search, localStorage))
  const change = useCallback((next: PanelId[]) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
    } catch {
      // Storage blocked: the layout lasts for this visit, and the link still carries it.
    }
    history.replaceState(null, '', `${location.pathname}${layoutQuery(next)}${location.hash}`)
  }, [])
  return [layout, change] as const
}

/**
 * Full-screen network overview at /dashboard, for a TV or second monitor.
 * Every number is counted from an official feed; nothing is estimated. The
 * panels shown, and their order, are the viewer's choice (see CustomiseDialog);
 * each feed is read only while a panel needs it.
 */
export function Dashboard() {
  const now = useNow(15_000)
  const [layout, setLayout] = useLayout()
  const [customising, setCustomising] = useState(false)
  const has = (id: PanelId) => layout.includes(id)

  const { events, loading, fetchedAt, error } = useTrafficData()
  const { fires } = useBushfires(has('fires') || has('fire-count'))
  const { gauges } = useGauges(has('gauges'))
  const { sites, volumes } = useSignals(has('signals'))
  const wantTransit = has('transit') || has('trains')
  const { updates } = useTripUpdates(wantTransit)
  const { vehicles } = useLiveVehicles(wantTransit)
  const { alerts } = useTransitAlerts(has('transit'))
  const parking = useCarParkSpaces(has('parking'))
  const council = useCouncilDashboard({ corridors: has('corridors'), events: has('council-events'), pedestrians: has('foot-traffic') })
  const { snapshot: news } = useNews(has('news') || has('outages') || has('centres') || has('timeline'))
  const { stations: airStations } = useAirQuality(has('air') || has('air-count'))
  const { mode, toggle } = useColorMode()

  const showNews = has('news')
  const headlines = useMemo(() => (news && showNews ? headlineStories(groupStories(news.items), now) : null), [news, showNews, now])
  const current = useMemo(() => currentEvents(events, now), [events, now])
  // Today's remaining timed events, or tomorrow's once today's are over.
  const todaysEvents = useMemo(() => {
    if (!council.events) return null
    const all = upcomingEvents(council.events, now, 100)
    const today = all.filter((e) => dayKey.format(e.start) === dayKey.format(now))
    return (today.length ? today : all).slice(0, 6)
  }, [council.events, now])

  const data: DashboardData = {
    now,
    loading,
    current,
    districts: useMemo(() => closuresAndCrashesByDistrict(events, now).slice(0, 7), [events, now]),
    transit: useMemo(() => (updates ? punctuality(updates, vehicles, now, (t) => modeOf(t.route, t.region)) : null), [updates, vehicles, now]),
    liftOutages: useMemo(() => (alerts ?? []).filter((a) => isAccessibilityAlert(a) && alertActive(a, now)), [alerts, now]),
    fires,
    fireLevels: useMemo(() => (fires ? firesByLevel(fires) : null), [fires]),
    rising: useMemo(() => (gauges ? fastestRising(gauges, 60 * 60_000, 6) : null), [gauges]),
    busy: useMemo(() => (sites && volumes ? busiestSignals(sites, volumes, 6) : null), [sites, volumes]),
    corridorRows: useMemo(() => (council.corridors ? corridorReport(council.corridors.corridors, council.corridors.months) : null), [council.corridors]),
    todaysEvents,
    eventsTomorrow: !!todaysEvents?.length && dayKey.format(todaysEvents[0].start) !== dayKey.format(now),
    foot: useMemo(() => (council.pedestrians ? footTraffic(council.pedestrians.hours) : null), [council.pedestrians]),
    parking,
  }
  const monitor: MonitorData = { now, outages: news?.outages ?? null, centres: news?.centres ?? null, airStations }
  const ticker = useMemo(() => latestEvents(events, now, 20), [events, now])

  const render = (id: PanelId) => PANEL_VIEWS[id]?.(data) ?? MONITOR_VIEWS[id]?.(monitor) ?? null
  const stats = panelsOf(layout, 'stat')
  const tiles = panelsOf(layout, 'tile')
  useEffect(() => {
    document.title = `Roadbeat dashboard · ${layout.length} ${layout.length === 1 ? 'panel' : 'panels'}`
  }, [layout])

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
          <a href="/status" className="hover:text-kumo-default hover:underline" title="Every feed the app reads, its health and where it comes from">
            Status
          </a>
          <Button variant="ghost" size="sm" icon={<SlidersHorizontalIcon />} onClick={() => setCustomising(true)}>
            Customise
          </Button>
          <Button variant="ghost" shape="square" aria-label="Back to the app" icon={<ArrowLeftIcon />} onClick={() => location.assign('/')} />
          <Button variant="ghost" shape="square" aria-label="Toggle colour mode" icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={toggle} />
          <Button variant="ghost" shape="square" aria-label="Full screen" icon={<ArrowsOutIcon />} onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} />
        </span>
      </header>

      {layout.length === 0 && (
        <p className="rounded-xl bg-kumo-base px-5 py-8 text-center text-sm text-kumo-subtle ring ring-kumo-line">
          Nothing is shown. Choose panels with <span className="font-medium text-kumo-strong">Customise</span>.
        </p>
      )}

      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((id) => (
            <PanelSlot key={id}>{render(id)}</PanelSlot>
          ))}
        </div>
      )}

      {showNews && <WhatsHappening stories={headlines} now={now} />}

      {tiles.length > 0 && (
        // On a TV-sized screen the panels share the space left on the page; below that they take their natural height and the page scrolls.
        <div className={`grid gap-4 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-4 ${tiles.length > 4 ? 'xl:grid-rows-2' : 'xl:grid-rows-1'}`}>
          {tiles.map((id) => (
            <PanelSlot key={id}>{render(id)}</PanelSlot>
          ))}
        </div>
      )}

      {has('ticker') && <Ticker events={ticker} now={now} />}

      {has('timeline') && <TimelineStrip now={now} news={news} />}

      <CustomiseDialog open={customising} onOpenChange={setCustomising} layout={layout} onChange={setLayout} />
    </div>
  )
}

/** Keeps a panel's place in the grid even while its view is empty, so the layout doesn't jump as feeds answer. */
function PanelSlot({ children }: { children: React.ReactNode }) {
  return <>{children ?? <div className="rounded-xl bg-kumo-base ring ring-kumo-line" aria-hidden />}</>
}
