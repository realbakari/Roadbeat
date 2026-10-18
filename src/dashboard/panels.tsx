import type { ReactNode } from 'react'
import { FIRE_LEVEL_LABEL, FIRE_TEXT, type FireLevel, type FireWarning } from '../api/bushfires'
import { CORRIDORS_URL, EVENTS_URL, PEDESTRIANS_URL, type CouncilEvent } from '../api/bccDashboard'
import type { CarParkSpaces } from '../api/bccParking'
import type { TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { CLOSURE_BAR, CLOSURE_TEXT, CRASH_BAR, CRASH_TEXT } from '../lib/dashboardTones'
import { isClosure } from '../lib/filters'
import { dsColor } from '../lib/signals'
import type { BusySignal, DistrictCount, FootTraffic, Punctuality, RisingGauge, corridorReport } from '../lib/dashboard'
import { ON_TIME } from '../lib/dashboard'
import type { PanelId } from '../lib/dashboardLayout'
import { EmptyNote, Row, Stat, Tile } from './Tile'
import { NewTabNote } from '../components/NewTabNote'
import { brisbaneClock as timeOnly } from '../lib/aest'

// The dashboard's panels, each rendered from the data Dashboard.tsx gathers.
// A panel shows only what its source published; the source line says which.

/** Everything the panels can show. A null list means its source hasn't answered yet, or its panel is hidden. */
export interface DashboardData {
  now: number
  loading: boolean
  current: TrafficEvent[]
  districts: DistrictCount[]
  transit: Punctuality[] | null
  liftOutages: TransitAlert[]
  fires: FireWarning[] | null
  fireLevels: { level: FireLevel; count: number }[] | null
  rising: RisingGauge[] | null
  busy: BusySignal[] | null
  corridorRows: ReturnType<typeof corridorReport> | null
  todaysEvents: CouncilEvent[] | null
  eventsTomorrow: boolean
  foot: FootTraffic[] | null
  parking: CarParkSpaces | null
}

const MODE_LABEL = { train: 'Trains', bus: 'Buses', tram: 'Trams', ferry: 'Ferries' } as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

/** Seconds as m:ss. */
function mmss(sec: number | null) {
  if (sec == null) return '–'
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const sourceLink = (href: string, children: ReactNode) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2">
    {children}
    <NewTabNote />
  </a>
)

/** The panels that come from the road, transit, fire and Brisbane City Council feeds. Others are in panelsMonitor.tsx. */
export const PANEL_VIEWS: Partial<Record<PanelId, (d: DashboardData) => ReactNode>> = {
  events: (d) => <Stat label="Road events happening now" value={d.loading ? '…' : d.current.length} href="/" />,
  closures: (d) => <Stat label="Road closures" value={d.loading ? '…' : d.current.filter(isClosure).length} tone={CLOSURE_TEXT} href="/" />,
  crashes: (d) => <Stat label="Crashes" value={d.loading ? '…' : d.current.filter((e) => e.properties.event_type === 'Crash').length} tone={CRASH_TEXT} href="/" />,
  'fire-count': (d) => {
    const urgent = d.fires?.filter((f) => f.level === 'Emergency Warning' || f.level === 'Watch and Act').length
    return <Stat label="Bushfire Emergency or Watch and Act" value={urgent ?? '…'} tone={urgent ? FIRE_TEXT['Watch and Act'] : undefined} />
  },
  trains: (d) => {
    const trains = d.transit?.find((t) => t.mode === 'train')
    return <Stat label="Tracked trains on time" value={trains?.tracked ? `${pct(trains.onTime, trains.tracked)}%` : '…'} tone="text-kumo-success" href="/#transit" />
  },
  parking: ({ parking }) => (
    <Stat
      label={parking ? `Free in council CBD car parks: King George Sq ${parking.kingGeorgeSquare ?? '–'}, Wickham Tce ${parking.wickhamTerrace ?? '–'}` : 'Free in council CBD car parks'}
      value={parking ? (parking.kingGeorgeSquare ?? 0) + (parking.wickhamTerrace ?? 0) : '…'}
    />
  ),

  districts: (d) => {
    const max = Math.max(1, ...d.districts.map((x) => x.closures + x.crashes))
    return (
      <Tile title="Closures and crashes by district" source="QLDTraffic events in effect now.">
        {d.districts.length ? (
          <ul className="grid gap-1.5">
            {d.districts.map((x) => (
              <Row
                key={x.district}
                label={x.district}
                value={
                  <span className="flex gap-3">
                    <span className={CLOSURE_TEXT}>{x.closures} closed</span>
                    <span className={CRASH_TEXT}>{x.crashes} crash{x.crashes === 1 ? '' : 'es'}</span>
                  </span>
                }
                bar={(x.closures + x.crashes) / max}
                barClass={x.crashes > x.closures ? CRASH_BAR : CLOSURE_BAR}
              />
            ))}
          </ul>
        ) : (
          <EmptyNote>{d.loading ? 'Loading road events…' : 'No closures or crashes reported.'}</EmptyNote>
        )}
      </Tile>
    )
  },

  transit: (d) => (
    <Tile
      title="Public transport running"
      source={
        <>
          {d.liftOutages.length > 0 && (
            <span className="mb-1 block text-sm">
              <span className="font-medium text-kumo-warning">
                {d.liftOutages.length} lift or escalator {d.liftOutages.length === 1 ? 'outage' : 'outages'}:
              </span>{' '}
              <span className="text-kumo-subtle">{d.liftOutages.map((a) => a.header.replace(/^(lift|escalator) outage\s*-\s*/i, '')).join('; ')}</span>
            </span>
          )}
          {`TransLink real-time, trips with a vehicle reporting its position. On time: ${-ON_TIME.early / 60} min early to under ${ON_TIME.late / 60} min late, as reported. Not TransLink's official punctuality figure.`}
        </>
      }
    >
      {d.transit?.length ? (
        <ul className="grid gap-2.5">
          {d.transit.map((t) => (
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
        <EmptyNote>{d.transit ? 'No tracked services right now.' : 'Loading TransLink real-time…'}</EmptyNote>
      )}
    </Tile>
  ),

  fires: (d) => (
    <Tile title="Bushfires" source="Queensland Fire Department current incidents and warnings.">
      {d.fireLevels && d.fires ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {d.fireLevels.map(({ level, count }) => (
              <div key={level} className="grid gap-0.5 rounded-lg px-3 py-2 ring ring-kumo-line">
                <span className={`text-2xl font-semibold tabular-nums ${count ? FIRE_TEXT[level] : ''}`}>
                  {count}
                </span>
                <span className="truncate text-xs text-kumo-subtle">{FIRE_LEVEL_LABEL[level]}</span>
              </div>
            ))}
          </div>
          <ul className="grid gap-0.5">
            {d.fires.slice(0, 2).map((f) => (
              <Row key={f.id} label={f.title} detail={FIRE_LEVEL_LABEL[f.level]} value="" href={`/#fire/${encodeURIComponent(f.id)}`} />
            ))}
          </ul>
        </div>
      ) : (
        <EmptyNote>Loading bushfire warnings…</EmptyNote>
      )}
    </Tile>
  ),

  gauges: (d) => (
    <Tile title="Brisbane creeks rising fastest" source="Brisbane City Council stream gauges, change over the last hour between readings reported in it. A gauge with no reading in that hour is left out. Heights only, not flood levels.">
      {d.rising?.length ? (
        <ul className="grid gap-1.5">
          {d.rising.map((r) => (
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
        <EmptyNote>{d.rising ? 'No stream gauge has risen in the last hour.' : 'Loading gauges…'}</EmptyNote>
      )}
    </Tile>
  ),

  signals: (d) => (
    <Tile title="Busiest intersections" source="Brisbane City Council signals: the most saturated lane in each site's latest measured cycle.">
      {d.busy?.length ? (
        <ul className="grid gap-1.5">
          {d.busy.map((b) => (
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
        <EmptyNote>{d.busy ? 'No intersection data in the latest batch.' : 'Loading intersections…'}</EmptyNote>
      )}
    </Tile>
  ),

  corridors: (d) => (
    <Tile
      title="Key corridor travel times"
      source={
        sourceLink(
          CORRIDORS_URL,
          `Brisbane City Council measured averages${d.corridorRows ? ` for ${MONTHS[d.corridorRows.month - 1]} ${d.corridorRows.year}` : ''}: AM peak 7–9 am, PM peak 4–7 pm. Change is from the same month a year earlier.`,
        )
      }
    >
      {d.corridorRows?.rows.length ? (
        <ul className="grid gap-1">
          {d.corridorRows.rows.slice(0, 7).map((r) => (
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
        <EmptyNote>{d.corridorRows ? 'No corridor results published.' : 'Loading corridor results…'}</EmptyNote>
      )}
    </Tile>
  ),

  'council-events': (d) => (
    <Tile title={d.eventsTomorrow ? 'Council events tomorrow' : 'Council events today'} source={sourceLink(EVENTS_URL, 'Brisbane City Council events. Timed events still to start; all-day listings left out.')}>
      {d.todaysEvents?.length ? (
        <ul className="grid gap-1">
          {d.todaysEvents.map((e) => (
            <Row key={`${e.title}-${e.start}`} label={e.title} detail={e.venue ?? undefined} value={<span className="text-kumo-subtle">{timeOnly.format(e.start)}</span>} href={e.url ?? undefined} />
          ))}
        </ul>
      ) : (
        <EmptyNote>{d.todaysEvents ? 'No more timed council events today or tomorrow.' : 'Loading council events…'}</EmptyNote>
      )}
    </Tile>
  ),

  'foot-traffic': (d) => (
    <Tile
      title="CBD foot traffic yesterday"
      source={sourceLink(PEDESTRIANS_URL, 'Brisbane City Council sensors count movements across a line, not people. Hours the council estimated, or published as under 25, are left out.')}
    >
      {d.foot?.length ? (
        <ul className="grid gap-1.5">
          {d.foot.slice(0, 6).map((f) => (
            <Row
              key={f.precinct}
              label={f.precinct}
              detail={f.measuredHours < f.hours ? `${f.measuredHours} of ${f.hours} sensor-hours measured` : undefined}
              value={f.movements.toLocaleString('en-AU')}
              bar={f.movements / Math.max(1, d.foot![0].movements)}
              color="var(--color-kumo-brand)"
            />
          ))}
        </ul>
      ) : (
        <EmptyNote>{d.foot ? 'No counts published for yesterday yet.' : 'Loading foot traffic…'}</EmptyNote>
      )}
    </Tile>
  ),
}
