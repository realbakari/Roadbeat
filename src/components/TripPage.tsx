import { Button, Loader, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, BroadcastIcon, CrosshairIcon, WarningIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import type { StopIndex } from '../api/stops'
import { routeInfo } from '../api/translink'
import type { LiveVehicle, TransitRegion } from '../api/transitTypes'
import { useTripsOn } from '../hooks/useTimetable'
import { useNow } from '../hooks/useNow'
import { useStopIndex, useTripIndex, useTripUpdates } from '../hooks/useTransitFeeds'
import { stopHref } from '../lib/departures'
import { readableTextOn } from '../lib/routeColor'
import { delayOf } from '../lib/timeFormat'
import { liveTrip, pickRun, tripNumber, tripStops, type TripStopRow } from '../lib/trip'
import { ClampedText } from './ClampedText'
import { DelayChip } from './Realtime'
import { brisbaneClock as clock, brisbaneDate } from '../lib/aest'
import { RelativeTime } from './ui/RelativeTime'

const dayLabel = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const STATUS: Record<NonNullable<LiveVehicle['status']>, string> = {
  stopped: 'Stopped at',
  arriving: 'Arriving at',
  moving: 'On the way to',
}

const HERE: Record<NonNullable<LiveVehicle['status']>, string> = {
  stopped: 'Vehicle stopped here now',
  arriving: 'Vehicle arriving here now',
  moving: 'Vehicle on the way here now',
}

/** Real-time applies to a run timetabled within this of now. */
const CURRENT = 2 * 3_600_000

/**
 * One trip's stops in order, like the trip view in TripView and TransitPulse:
 * published times, plus whatever TransLink's real-time feeds report for it.
 */
export function TripPage({
  region,
  tripId,
  route: routeParam,
  date,
  vehicles,
  onNavigate,
}: {
  region: TransitRegion
  tripId: string
  route: string | null
  /** The run's service day, when the link names one. */
  date: string | null
  vehicles: LiveVehicle[]
  onNavigate: (hash: string) => void
}) {
  const now = useNow(15_000)
  const number = tripNumber(tripId)
  const { updates, error } = useTripUpdates(true)
  const anyRun = useMemo(() => liveTrip(updates, vehicles, region, number, null), [updates, vehicles, region, number])
  const route = routeParam ?? anyRun.update?.route ?? anyRun.vehicle?.route ?? null
  const info = route ? routeInfo(route, region) : null
  const codes = useMemo(() => (route ? [route] : null), [route])
  const trips = useTripsOn(region, codes, date ?? brisbaneDate(now), !date)
  const run = useMemo(() => (trips ? pickRun(trips, number, date, anyRun.update, now) : null), [trips, number, date, anyRun.update, now])
  const current = !run || (run.stops[0].time - CURRENT <= now && now <= run.stops[run.stops.length - 1].time + CURRENT)
  const live = useMemo(
    () => (current ? liveTrip(updates, vehicles, region, number, run?.stops[0].time ?? null) : { update: null, vehicle: null }),
    [current, updates, vehicles, region, number, run],
  )
  const stops = useStopIndex(true, info?.mode === 'bus' || !info)
  const tripIndex = useTripIndex(!run)
  const sameStop = useMemo(() => stationMatcher(stops, region), [stops, region])
  const rows = useMemo(() => tripStops(run, live.update, live.vehicle, sameStop), [run, live, sameStop])
  const headsign = run?.headsign ?? tripIndex?.get(region, tripId)?.headsign ?? null
  const loading = (route && !trips) || (!route && !updates && !error)
  const cancelled = live.update?.relationship === 'cancelled'
  const v = live.vehicle

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={() => history.back()}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-5 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            {route && (
              <span
                className={`flex h-7 min-w-11 shrink-0 items-center justify-center rounded px-1.5 text-sm font-semibold ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
                style={
                  info?.color
                    ? {
                        backgroundColor: info.color,
                        color: readableTextOn(info.color),
                      }
                    : undefined
                }
              >
                {info?.line?.split(' ')[0] ?? info?.short ?? route}
              </span>
            )}
            <div className="grid min-w-0 gap-0.5">
              <Text as="h2" variant="heading" size="lg">
                {headsign ? `To ${headsign}` : (info?.long ?? 'Trip')}
              </Text>
              <Text variant="secondary">
                {[
                  info?.line ?? info?.long,
                  run && `${dayLabel.format(Date.parse(run.key.slice(-10)))}, timetabled from ${clock.format(run.stops[0].time)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {cancelled && <p className="text-sm font-semibold text-kumo-danger">TransLink's real-time feed marks this trip cancelled.</p>}
              {live.update?.relationship === 'added' && <Text variant="secondary">An extra service, not in the published timetable.</Text>}
            </div>
          </header>

          {current && !cancelled && (
            <section className="grid gap-2 rounded-lg p-3 ring ring-kumo-line">
              {v ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-kumo-success">
                    <BroadcastIcon size={14} weight="bold" /> Vehicle reporting its position
                  </span>
                  <Text size="sm">
                    {v.stopId
                      ? `${STATUS[v.status ?? 'moving']} ${stopName(stops, region, v.stopId)}`
                      : 'Position reported, with no stop given'}
                    {v.timestamp ? <> · last reported <RelativeTime at={v.timestamp} now={now} /></> : ''}
                  </Text>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="justify-self-start"
                    icon={<CrosshairIcon />}
                    onClick={() => onNavigate(`vehicle/${encodeURIComponent(v.id)}`)}
                  >
                    Follow on the map
                  </Button>
                </>
              ) : (
                <Text size="sm" variant="secondary">
                  {!updates
                    ? error
                      ? "Couldn't load TransLink's real-time feed."
                      : 'Checking the real-time feed…'
                    : live.update
                      ? "TransLink's real-time feed lists this trip, but no vehicle is reporting its position."
                      : "No vehicle is reporting its position for this trip, and it isn't in TransLink's real-time feed."}
                </Text>
              )}
            </section>
          )}

          {loading ? (
            <Loader />
          ) : !rows.length ? (
            <Text variant="secondary">
              {route
                ? `TransLink's published timetable has no run of this trip${date ? ` on ${dayLabel.format(Date.parse(date))}` : ' today'}.`
                : "This trip isn't in TransLink's real-time feed right now, and the link doesn't say which route it's on."}
            </Text>
          ) : (
            <>
              <PatternChanges rows={rows} />
              <ol className="grid">
                {rows.map((r, i) => (
                  <StopRow
                    key={i}
                    row={r}
                    prev={rows[i - 1] ?? null}
                    next={rows[i + 1] ?? null}
                    stops={stops}
                    region={region}
                    vehicle={v}
                    onNavigate={onNavigate}
                  />
                ))}
              </ol>
            </>
          )}

          <ClampedText
            lines={3}
            className="text-xs text-kumo-subtle"
            text="Times are TransLink's published timetable. Where TransLink's real-time feed reports a stop, its time and delay are shown under the timetabled time, marked real-time; stops the feed doesn't list show the timetable only, and nothing is filled in between. A stop is marked passed only when the vehicle reports a later stop as its current one. A stop on a dashed stretch is one the real-time feed lists that the timetable doesn't; a struck-out stop is one the feed says the trip won't stop at. A stop the feed simply leaves out isn't marked: the feed often omits a trip's last stops. Updates every 15 seconds."
          />
        </div>
      </div>
    </div>
  )
}

function StopRow({
  row,
  prev,
  next,
  stops,
  region,
  vehicle,
  onNavigate,
}: {
  row: TripStopRow
  prev: TripStopRow | null
  next: TripStopRow | null
  stops: StopIndex | null
  region: TransitRegion
  vehicle: LiveVehicle | null
  onNavigate: (hash: string) => void
}) {
  const stop = stops?.get(region, row.stopId)
  const station = stop ? stops!.station(stop) : null
  const s = row.scheduled
  const rt = row.rt
  const delay = rt?.delay ?? (s ? delayOf(rt?.time, s.time) : null)
  const skipped = !!rt?.skipped
  const was = row.movedFrom ? stops?.get(region, row.movedFrom)?.platform : null
  // A stretch to or from a stop only the feed lists is drawn dashed, as a change of route.
  const rail = (other: TripStopRow, done: boolean) =>
    `absolute h-full border-l-2 ${row.added || other.added ? 'border-dashed border-kumo-warning' : done ? 'border-kumo-line' : 'border-kumo-contrast/40'}`
  return (
    <li className="flex items-stretch gap-3">
      <span className="relative flex w-4 shrink-0 justify-center" aria-hidden>
        {next && <span className={`top-1/2 ${rail(next, row.passed)}`} />}
        {prev && <span className={`bottom-1/2 ${rail(prev, row.passed || row.here)}`} />}
        <span
          className={`relative z-10 my-auto ring-2 ${
            row.here
              ? 'size-3 rounded-full bg-kumo-success ring-kumo-success'
              : skipped
                ? 'size-2 rounded-full bg-kumo-base ring-kumo-danger/70'
                : row.added
                  ? 'size-2.5 rotate-45 bg-kumo-base ring-kumo-warning'
                  : row.passed
                    ? 'size-3 rounded-full bg-kumo-base ring-kumo-line'
                    : 'size-3 rounded-full bg-kumo-base ring-kumo-contrast'
          }`}
        />
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5">
        <span className="grid min-w-0">
          <button
            type="button"
            onClick={() => onNavigate(stopHref(region, station?.id ?? row.stopId))}
            className={`truncate text-left text-sm hover:underline ${row.passed || skipped ? 'text-kumo-subtle' : ''} ${skipped ? 'line-through' : ''}`}
          >
            {station?.name ?? `Stop ${row.stopId}`}
          </button>
          <span className="flex flex-wrap gap-x-2 text-xs text-kumo-subtle">
            {stop?.platform &&
              (row.movedFrom ? (
                <span className="text-kumo-warning" title="TransLink's real-time feed reports a different platform from the timetable">
                  Platform {stop.platform}
                  {was ? ` (timetabled ${was})` : ' (platform changed)'}
                </span>
              ) : (
                <span>Platform {stop.platform}</span>
              ))}
            {row.added && <span className="text-kumo-warning">Not in the timetable (real-time)</span>}
            {s?.kind === 'arrival' && <span>Drop-off only</span>}
            {s?.kind === 'pickup' && <span>Pick-up only</span>}
            {rt?.skipped && <span className="text-kumo-danger">Not stopping (real-time)</span>}
            {row.passed && <span>Passed</span>}
            {row.here && vehicle && <span className="text-kumo-success">{HERE[vehicle.status ?? 'moving']}</span>}
          </span>
        </span>
        <span className="grid shrink-0 justify-items-end tabular-nums">
          {s && <span className={`text-sm ${row.passed ? 'text-kumo-subtle' : 'font-medium'}`}>{clock.format(s.time)}</span>}
          {rt?.time != null && !rt.skipped && (
            <span className="inline-flex items-center gap-1 text-xs text-kumo-success" title="TransLink's real-time feed">
              <BroadcastIcon size={11} weight="bold" />
              {clock.format(rt.time)}
              {s && <DelayChip delay={delay} />}
            </span>
          )}
        </span>
      </div>
    </li>
  )
}

/** One line on how the feed's stops differ from the timetable, when they do. */
function PatternChanges({ rows }: { rows: TripStopRow[] }) {
  const skipped = rows.filter((r) => r.rt?.skipped).length
  const added = rows.filter((r) => r.added).length
  const moved = rows.filter((r) => r.movedFrom).length
  if (!skipped && !added && !moved) return null
  const n = (k: number, one: string, many: string) => (k === 1 ? `1 ${one}` : `${k} ${many}`)
  const parts = [
    added && n(added, 'stop not in the timetable', 'stops not in the timetable'),
    skipped && n(skipped, 'stop not served', 'stops not served'),
    moved && n(moved, 'platform change', 'platform changes'),
  ].filter(Boolean)
  return (
    <div className="flex items-start gap-2 rounded-lg bg-kumo-warning/10 px-3 py-2 text-sm">
      <WarningIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-kumo-warning" />
      <span>TransLink's real-time feed differs from the timetable for this trip: {parts.join(', ')}.</span>
    </div>
  )
}

function stopName(stops: StopIndex | null, region: TransitRegion, id: string) {
  const s = stops?.get(region, id)
  return s ? s.name : `stop ${id}`
}

/** Two stop ids are the same stop if they are, or are platforms of one station. */
function stationMatcher(stops: StopIndex | null, region: TransitRegion) {
  return (a: string, b: string) => {
    if (a === b) return true
    const x = stops?.get(region, a)
    const y = stops?.get(region, b)
    return !!x && !!y && stops!.station(x).id === stops!.station(y).id
  }
}
