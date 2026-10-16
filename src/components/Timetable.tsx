import { Badge, Button, Loader, Select, Tabs, Text } from '@cloudflare/kumo'
import { BoatIcon, BroadcastIcon, BusIcon, CalendarDotsIcon, TrainIcon, TramIcon } from '@phosphor-icons/react'
import { useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { StopIndex } from '../api/stops'
import {
  brisbaneDate,
  dayStart,
  dayStart as calendarStart,
  routesAtStops,
  timetableDates,
  type ScheduledStop,
  type ScheduledTrip,
  type TimetableIndex,
} from '../api/timetables'
import { routeInfo, type LiveVehicle, type StopTime, type TransitRegion, type TripUpdates } from '../api/translink'
import { useTripsOn } from '../hooks/useTimetable'
import { delayOf, minutesUntil, useTimeFormat, type TimeFormat } from '../lib/timeFormat'
import { DelayChip } from './Realtime'
import { useNow, useStopIndex, useTimetableIndex, useTripUpdates } from '../hooks/useTrafficData'
import { stopHref } from '../lib/departures'
import { timetableCodes } from '../lib/transitLines'
import { liveLookup, scheduledArrivals, scheduledDepartures, timetableGrid, type GridDirection, type LiveTrip, type ScheduledDeparture } from '../lib/timetable'
import { readableTextOn } from '../lib/routeColor'

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })
const dayLabel = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const hourLabel = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric' })

/** "5:42am": compact enough for a grid cell. */
const short = (t: number) => clock.format(t).replace(/\s/g, '')
const weekday = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short' })

function DayPicker({ dates, value, today, onChange }: { dates: string[]; value: string; today: string; onChange: (d: string) => void }) {
  const items = useMemo(() => {
    const tomorrow = brisbaneDate(Date.parse(today) + 36 * 3_600_000)
    return Object.fromEntries(
      dates.map((d) => [d, d === today ? `Today, ${dayLabel.format(Date.parse(d))}` : d === tomorrow ? `Tomorrow, ${dayLabel.format(Date.parse(d))}` : dayLabel.format(Date.parse(d))]),
    )
  }, [dates, today])
  return <Select aria-label="Day" size="sm" className="w-56" value={value} onValueChange={(v) => onChange(v as string)} items={items} />
}

/** Day picker state over the dates the published timetable covers. */
function useDay(index: TimetableIndex | null, region: TransitRegion, now: number) {
  const today = brisbaneDate(now)
  const dates = useMemo(() => (index ? timetableDates(index, region, today) : []), [index, region, today])
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked && dates.includes(picked) ? picked : (dates[0] ?? null)
  return { today, dates, date, setDate: setPicked }
}

function Unavailable() {
  return <Text variant="secondary">TransLink's published timetable isn't available here right now.</Text>
}

/** Reported state of one timetabled stop: delay, skip or cancellation. */
function liveStop(live: LiveTrip | null, s: ScheduledStop): { rt: StopTime | null; late: boolean; gone: boolean } {
  const rt = live?.stops.get(s.stopId) ?? null
  const late = rt?.time != null && Math.abs(rt.time - s.time) >= 60_000
  return { rt, late, gone: !!live?.cancelled || !!rt?.skipped }
}

/** A line's full published timetable: a day picker and a stop × trip grid per direction. */
export function LineTimetable({
  match,
  mode,
  vehicles,
  onNavigate,
}: {
  match: (code: string) => boolean
  mode: string
  vehicles: LiveVehicle[]
  onNavigate: (hash: string) => void
}) {
  const now = useNow(30_000)
  const { index, failed } = useTimetableIndex(true)
  const { today, dates, date, setDate } = useDay(index, 'SEQ', now)
  const codes = useMemo(() => {
    const all = index?.regions.SEQ?.routes
    return all ? timetableCodes(all.filter(match), index!, mode) : null
  }, [index, match, mode])
  const trips = useTripsOn('SEQ', codes, date)
  const stops = useStopIndex(true, mode === 'bus')
  const { updates } = useTripUpdates(true)
  const grid = useMemo(() => (trips ? timetableGrid(trips, stops) : null), [trips, stops])
  const live = useMemo(() => liveLookup(date === today ? updates : null, vehicles), [date, today, updates, vehicles])
  const [tab, setTab] = useState(0)

  if (failed) return <Unavailable />
  if (!index || !date) return index ? <Unavailable /> : <Loader size="sm" />
  if (codes && !codes.length) return <Text variant="secondary">This line isn't in TransLink's published timetable.</Text>

  const dir = grid?.length ? grid[Math.min(tab, grid.length - 1)] : null
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DayPicker dates={dates} value={date} today={today} onChange={setDate} />
        {grid && grid.length > 1 && (
          <Tabs
            size="sm"
            value={String(Math.min(tab, grid.length - 1))}
            onValueChange={(v) => setTab(Number(v))}
            tabs={grid.map((d, i) => ({ value: String(i), label: directionLabel(d) }))}
          />
        )}
      </div>
      {!grid ? (
        <Loader size="sm" />
      ) : !dir ? (
        <Text variant="secondary">No services on this line on {dayLabel.format(Date.parse(date))}.</Text>
      ) : (
        <>
          <Text size="sm" variant="secondary">
            {dir.trips.length} services to {dir.headsigns.map(shortName).join(', ')}
          </Text>
          <Grid
            dir={dir}
            now={date === today ? now : null}
            live={live}
            stops={stops}
            onNavigate={onNavigate}
            key={`${date}-${dir.direction}`}
          />
          <GridLegend today={date === today} />
        </>
      )}
    </div>
  )
}

function Grid({
  dir,
  now,
  live,
  stops,
  onNavigate,
}: {
  dir: GridDirection
  now: number | null
  live: ReturnType<typeof liveLookup>
  stops: StopIndex | null
  onNavigate: (hash: string) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  // When the grid opened (it remounts per day and direction), so later clock ticks don't scroll it.
  const [openedAt] = useState(now)
  const manyHeads = dir.headsigns.length > 1
  const liveTrips = useMemo(() => dir.trips.map((t) => live.get(t)), [dir, live])
  // The service picked to see its stops in order, as transit apps do.
  const [picked, setPicked] = useState<string | null>(null)
  const sel = dir.trips.findIndex((t) => t.key === picked)

  // Jump to the first service at or after `t` at the reference stop (today opens at "now", as TransLink's does).
  const jump = (t: number) => {
    const el = scroller.current
    if (!el) return
    const ref = dir.reference
    const next = dir.cells.findIndex((c) => (c[ref] ?? c.find(Boolean))!.time >= t)
    const th = el.querySelector<HTMLElement>(`[data-col="${next < 0 ? dir.trips.length - 1 : next}"]`)
    const first = el.querySelector<HTMLElement>('th')
    if (th && first) el.scrollLeft = th.offsetLeft - first.offsetWidth
  }
  // Runs when the grid opens (a new day or direction), not on every clock tick.
  const jumpWhenOpened = useEffectEvent(jump)
  useLayoutEffect(() => {
    if (openedAt != null) jumpWhenOpened(openedAt)
  }, [dir, openedAt])

  const serviceDay = brisbaneDate(dir.trips[0].stops[0].time)
  const midnight = dayStart(serviceDay)
  const hours = Object.fromEntries([
    ...(now != null ? [['now', 'Now']] : []),
    ...Array.from({ length: 24 }, (_, h) => [String(h), h === 0 ? 'Midnight' : h === 12 ? 'Midday' : hourLabel.format(midnight + h * 3_600_000)]),
  ])
  return (
    <div className="grid gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Time"
        size="sm"
        className="w-32"
        placeholder="Jump to time"
        onValueChange={(v) => jump(v === 'now' ? Date.now() : midnight + Number(v) * 3_600_000)}
        items={hours}
      />
      {dir.rows[dir.reference]?.name && (
        <Text size="xs" variant="secondary">* Sorted by {shortName(dir.rows[dir.reference].name!)} departure time</Text>
      )}
    </div>
    <div ref={scroller} className="max-h-[60vh] overflow-auto rounded-lg ring ring-kumo-line">
      <table className="border-separate border-spacing-0 text-sm tabular-nums">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 min-w-48 border-r border-b border-kumo-line bg-kumo-base py-1.5 pr-3 pl-2 text-left font-medium">
              <span className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-kumo-contrast text-kumo-inverse" aria-hidden>
                  <ModeIcon mode={routeInfo(dir.trips[0].route)?.mode} />
                </span>
                Stop
              </span>
            </th>
            {dir.trips.map((t, i) => {
              const l = liveTrips[i]
              const info = routeInfo(t.route)
              return (
                <th
                  key={t.key}
                  data-col={i}
                  className={`sticky top-0 z-10 border-b border-kumo-line px-2 py-1.5 text-left align-bottom font-normal whitespace-nowrap ${i === sel ? 'bg-kumo-tint' : 'bg-kumo-base'}`}
                >
                  <button
                    type="button"
                    className="grid w-full text-left"
                    title={`To ${t.headsign} · ${info?.long ?? t.route} · show its stops`}
                    onClick={() => setPicked(i === sel ? null : t.key)}
                  >
                    {manyHeads && <span className="max-w-20 truncate text-xs text-kumo-subtle">{shortName(t.headsign)}</span>}
                    <LiveTag live={l} />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {dir.rows.map((row, r) => (
            <tr key={row.region + row.id}>
              <th className="sticky left-0 z-10 max-w-60 border-r border-kumo-line bg-kumo-base py-1 pr-3 pl-2 text-left font-normal">
                {/* The line and a circle per stop, as TransLink draws them; the stop the services are sorted by is filled. The sticky cell positions the line, so it runs the cell's full height. */}
                <span
                  className={`absolute left-[21px] w-1 bg-current text-kumo-inactive ${r === 0 ? 'top-1/2 bottom-0' : r === dir.rows.length - 1 ? 'top-0 bottom-1/2' : 'top-0 bottom-0'}`}
                  aria-hidden
                />
                <span className="relative flex items-center gap-2">
                  <span
                    className={`relative ml-[7px] size-4 shrink-0 rounded-full ring-[3px] ring-kumo-strong ring-inset ${r === dir.reference ? 'bg-kumo-strong' : 'bg-kumo-base'}`}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => onNavigate(stopHref(row.region, row.id))}
                    className={`block min-w-0 truncate text-left hover:underline ${r === dir.reference ? 'font-medium' : ''}`}
                    title={row.name ?? undefined}
                  >
                    {row.name ?? `Stop ${row.id}`}
                    {r === dir.reference && ' *'}
                  </button>
                </span>
              </th>
              {dir.cells.map((col, c) => {
                const s = col[r]
                if (!s)
                  return (
                    <td key={c} className={`h-9 px-2 text-center text-kumo-inactive ${c === sel ? 'bg-kumo-tint' : ''}`}>
                      —
                    </td>
                  )
                const l = liveTrips[c]
                const { rt, late, gone } = liveStop(l, s)
                const past = now != null && (rt?.time ?? s.time) < now - 60_000
                const here = l?.vehicle && vehicleAt(l.vehicle, s.stopId, stops)
                return (
                  <td
                    key={c}
                    className={`h-9 cursor-pointer px-2 leading-tight whitespace-nowrap ${past && !here ? 'text-kumo-subtle' : ''} ${here ? 'bg-kumo-success/15 font-medium ring-2 ring-kumo-success ring-inset' : c === sel ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
                    title={`${here ? `${VEHICLE_STATUS[l!.vehicle!.status ?? 'moving']} · ` : ''}${cellTitle(s, rt, l)} · tap for this service's stops`}
                    onClick={() => setPicked(c === sel ? null : dir.trips[c].key)}
                  >
                    <span className={gone || late ? 'line-through decoration-1' : ''}>{short(s.time)}</span>
                    {/* After midnight, the day, as TransLink shows it ("12:30 am Friday"). */}
                    {brisbaneDate(s.time) !== serviceDay && <span className="ml-1 text-xs text-kumo-subtle">{weekday.format(s.time)}</span>}
                    {s.kind !== 'normal' && (
                      <span className="block pt-0.5">
                        <StopKindBadge kind={s.kind} />
                      </span>
                    )}
                    {late && !gone && (
                      <span className={`block text-xs ${rt!.time! > s.time ? 'text-kumo-warning' : 'text-kumo-info'}`}>{short(rt!.time!)}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {sel >= 0 && (
      <TripView
        trip={dir.trips[sel]}
        live={liveTrips[sel]}
        now={now}
        stops={stops}
        onClose={() => setPicked(null)}
        onNavigate={onNavigate}
      />
    )}
    </div>
  )
}

/**
 * One service's stops in order with its published times, like the trip view in
 * transit apps. Today, the real-time feed adds reported times, skipped stops and
 * where the vehicle is.
 */
function TripView({
  trip,
  live,
  now,
  stops,
  onClose,
  onNavigate,
}: {
  trip: ScheduledTrip
  live: LiveTrip | null
  now: number | null
  stops: StopIndex | null
  onClose: () => void
  onNavigate: (hash: string) => void
}) {
  const info = routeInfo(trip.route, trip.region)
  const first = stops?.get(trip.region, trip.stops[0].stopId)
  const vehicleAtIdx = live?.vehicle ? trip.stops.findIndex((s) => vehicleAt(live.vehicle!, s.stopId, stops)) : -1
  return (
    <div className="grid gap-2 rounded-lg p-3 ring ring-kumo-line">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <Text bold>
            {clock.format(trip.stops[0].time)} {first ? shortName(stops!.station(first).name) : ''} to {shortName(trip.headsign)}
          </Text>
          <Text size="xs" variant="secondary">
            {info?.line ?? info?.short ?? trip.route} · {info?.long ?? ''}
            {live?.cancelled && <span className="font-medium text-kumo-danger"> · Cancelled</span>}
          </Text>
        </div>
        <div className="flex shrink-0 gap-1">
          {live?.vehicle && (
            <Button size="sm" variant="secondary" icon={<BroadcastIcon />} onClick={() => onNavigate(`vehicle/${encodeURIComponent(live.vehicle!.id)}`)}>
              Vehicle
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <ol className="grid">
        {trip.stops.map((s, i) => {
          const stop = stops?.get(trip.region, s.stopId)
          const station = stop ? stops!.station(stop) : null
          const { rt, late, gone } = liveStop(live, s)
          const shown = rt?.time ?? s.time
          // The feed drops stops a tracked trip has passed.
          const passed = now != null && (live?.vehicle ? (vehicleAtIdx >= 0 ? i < vehicleAtIdx : !rt && s.time < now) : shown < now - 60_000)
          const here = i === vehicleAtIdx
          const last = i === trip.stops.length - 1
          return (
            <li key={i} className="flex items-stretch gap-3">
              <span className="relative flex w-4 shrink-0 justify-center" aria-hidden>
                {!last && <span className={`absolute top-1/2 h-full w-0.5 ${passed ? 'bg-kumo-line' : 'bg-kumo-contrast/40'}`} />}
                {i > 0 && <span className={`absolute bottom-1/2 h-full w-0.5 ${passed || here ? 'bg-kumo-line' : 'bg-kumo-contrast/40'}`} />}
                <span
                  className={`relative z-10 my-auto size-3 rounded-full ring-2 ${here ? 'bg-kumo-success ring-kumo-success' : passed ? 'bg-kumo-base ring-kumo-line' : 'bg-kumo-base ring-kumo-contrast'}`}
                />
              </span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5">
                <span className="grid min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigate(stopHref(trip.region, station?.id ?? s.stopId))}
                    className={`truncate text-left hover:underline ${passed ? 'text-kumo-subtle' : ''} ${gone ? 'line-through' : ''}`}
                  >
                    {station?.name ?? `Stop ${s.stopId}`}
                  </button>
                  <span className="flex flex-wrap gap-x-2 text-xs text-kumo-subtle">
                    {stop?.platform && <span>Platform {stop.platform}</span>}
                    {s.kind !== 'normal' && <StopKindBadge kind={s.kind} />}
                    {rt?.skipped && <span className="text-kumo-danger">Not stopping</span>}
                    {here && <span className="text-kumo-success">{VEHICLE_STATUS[live!.vehicle!.status ?? 'moving']}</span>}
                  </span>
                </span>
                <span className="grid shrink-0 justify-items-end tabular-nums">
                  <span className={late || gone ? 'text-xs text-kumo-subtle line-through' : passed ? 'text-kumo-subtle' : 'font-medium'}>
                    {clock.format(s.time)}
                  </span>
                  {late && !gone && (
                    <span className={`font-medium ${rt!.time! > s.time ? 'text-kumo-warning' : 'text-kumo-info'}`}>{clock.format(rt!.time!)}</span>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const VEHICLE_STATUS = { stopped: 'Stopped here now', arriving: 'Arriving here now', moving: 'On the way here now' }

/** Whether a tracked vehicle reports this stop (or another platform of its station) as its current stop. */
function vehicleAt(v: LiveVehicle, stopId: string, stops: StopIndex | null) {
  if (!v.stopId) return false
  if (v.stopId === stopId) return true
  const a = stops?.get(v.region, v.stopId)
  const b = stops?.get(v.region, stopId)
  return !!a && !!b && stops!.station(a).id === stops!.station(b).id
}

function cellTitle(s: ScheduledStop, rt: StopTime | null, live: LiveTrip | null) {
  const parts = [`Timetabled ${clock.format(s.time)}`]
  if (s.kind === 'arrival') parts.push('drop-off only')
  if (s.kind === 'pickup') parts.push('pick-up only')
  if (live?.cancelled) parts.push('cancelled (real-time)')
  else if (rt?.skipped) parts.push('stop skipped (real-time)')
  else if (rt?.time != null) parts.push(`${live?.vehicle ? 'real-time' : 'expected'} ${clock.format(rt.time)}`)
  return parts.join(' · ')
}

/** Column header status for a trip the real-time feed reports on. */
function LiveTag({ live }: { live: LiveTrip | null }) {
  if (!live) return <div className="h-4" />
  if (live.cancelled) return <div className="text-xs font-medium text-kumo-danger">Cancelled</div>
  const d = live.update.stops.find((s) => s.delay != null)?.delay ?? null
  const m = d != null && Math.abs(d) >= 60 ? `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) / 60)} min` : live.vehicle ? 'On time' : ''
  return (
    <div className={`flex items-center gap-1 text-xs ${d != null && d >= 60 ? 'text-kumo-warning' : 'text-kumo-subtle'}`}>
      <span className={`size-1.5 rounded-full ${live.vehicle ? 'bg-kumo-success' : 'ring-1 ring-kumo-line ring-inset'}`} />
      {m}
    </div>
  )
}

function GridLegend({ today }: { today: boolean }) {
  return (
    <Text size="xs" variant="secondary">
      Times are TransLink's published timetable. Drop-off only: the service only lets passengers off there, usually where it ends. — doesn't
      stop. Times after midnight show the day. Tap a time or column to see that service's stops.
      {today && (
        <>
          {' '}
          For services in TransLink's real-time feed, a{' '}
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-kumo-success" /> green dot
          </span>{' '}
          means the vehicle is reporting its position, and a reported time different from the timetable is shown under it.
          A{' '}
          <span className="rounded-sm px-1 ring-2 ring-kumo-success ring-inset">highlighted</span> time is the stop a
          vehicle is at or heading to now; tap it to follow the vehicle. Updates every 30 seconds.
        </>
      )}
    </Text>
  )
}

/** "To Caboolture", or "From Caboolture" when trips end at several places but all start at one. */
function directionLabel(d: GridDirection) {
  if (d.headsigns.length === 1) return `To ${shortName(d.headsigns[0])}`
  const first = new Set(d.cells.map((c) => c.findIndex(Boolean)))
  const origin = first.size === 1 ? d.rows[[...first][0]] : null
  return origin?.name ? `From ${shortName(origin.name)}` : `To ${shortName(d.headsigns[0])} & more`
}

/** "Caboolture station" → "Caboolture" for labels. */
/** "Drop-off only" or "Pick-up only", in a tag as TransLink's timetables show it. */
function StopKindBadge({ kind }: { kind: 'arrival' | 'pickup' }) {
  return (
    <Badge variant="blue" className="whitespace-nowrap">
      {kind === 'arrival' ? 'Drop-off only' : 'Pick-up only'}
    </Badge>
  )
}

function ModeIcon({ mode }: { mode: string | undefined }) {
  const I = mode === 'bus' ? BusIcon : mode === 'ferry' ? BoatIcon : mode === 'tram' ? TramIcon : TrainIcon
  return <I size={16} weight="fill" />
}

function shortName(headsign: string) {
  return headsign.replace(/ station$/i, '')
}

/** A stop's full day of published departures across every route, with real-time where reported. */
export function StopTimetable({
  region,
  stopIds,
  stops,
  updates,
  vehicles,
  now,
  onNavigate,
}: {
  region: TransitRegion
  stopIds: Set<string>
  stops: StopIndex | null
  updates: TripUpdates | null
  vehicles: LiveVehicle[]
  now: number
  onNavigate: (hash: string) => void
}) {
  const { index, failed } = useTimetableIndex(true)
  const { today, dates, date, setDate } = useDay(index, region, now)
  const codes = useMemo(() => (index ? routesAtStops(index, region, stopIds).sort(byRoute) : null), [index, region, stopIds])
  // A stop's day is the calendar day, as on TransLink's stop pages: midnight to midnight,
  // including the previous service day's trips after midnight.
  const trips = useTripsOn(region, codes, date, true)
  const [route, setRoute] = useState('all')
  const [earlier, setEarlier] = useState(false)
  // As in the TransLink app: departures or drop-off-only arrivals, ordered by time or grouped by route.
  const [kind, setKind] = useState<'departures' | 'arrivals'>('departures')
  const [order, setOrder] = useState<'time' | 'route'>('time')
  const [format] = useTimeFormat()
  const live = useMemo(() => liveLookup(date === today ? updates : null, vehicles), [date, today, updates, vehicles])
  const all = useMemo(() => {
    if (!trips || !date) return null
    const from = calendarStart(date)
    const list = kind === 'arrivals' ? scheduledArrivals(trips, stopIds) : scheduledDepartures(trips, stopIds)
    const at = (d: ScheduledDeparture) => (kind === 'arrivals' ? d.stop.arrival : d.stop.time)
    return list.filter((d) => at(d) >= from && at(d) < from + 86_400_000)
  }, [trips, stopIds, date, kind])

  if (failed) return <Unavailable />
  if (!index || !date) return index ? <Unavailable /> : <Loader size="sm" />
  if (codes && !codes.length) return <Text variant="secondary">No services from this stop in TransLink's published timetable.</Text>

  const isToday = date === today
  const timeOf = (d: ScheduledDeparture) => (kind === 'arrivals' ? d.stop.arrival : d.stop.time)
  const filtered = all?.filter((d) => route === 'all' || d.trip.route === route) ?? null
  // Today, hide what has already left (by the reported time when the feed has one).
  const gone = (d: ScheduledDeparture) => {
    const rt = live.get(d.trip)?.stops.get(d.stop.stopId)?.time
    return Math.max(timeOf(d), rt ?? 0) < now - 60_000
  }
  const shown = filtered && isToday && !earlier ? filtered.filter((d) => !gone(d)) : filtered
  const hidden = filtered && shown ? filtered.length - shown.length : 0
  const routeKey = (d: ScheduledDeparture) => routeInfo(d.trip.route, region)?.line ?? routeInfo(d.trip.route, region)?.short ?? d.trip.route
  const list =
    shown && order === 'route'
      ? [...shown].sort((a, b) => byRoute(routeKey(a), routeKey(b)) || timeOf(a) - timeOf(b))
      : shown
  const groupOf = (d: ScheduledDeparture) => (order === 'route' ? routeKey(d) : hourLabel.format(timeOf(d)))

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          size="sm"
          value={kind}
          onValueChange={(v) => setKind(v as 'departures' | 'arrivals')}
          tabs={[
            { value: 'departures', label: 'Departures' },
            { value: 'arrivals', label: 'Arrivals' },
          ]}
        />
        <Tabs
          size="sm"
          value={order}
          onValueChange={(v) => setOrder(v as 'time' | 'route')}
          tabs={[
            { value: 'time', label: 'By time' },
            { value: 'route', label: 'By route' },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DayPicker dates={dates} value={date} today={today} onChange={setDate} />
        {codes && codes.length > 1 && (
          <Select
            aria-label="Route"
            size="sm"
            className="w-44"
            value={route}
            onValueChange={(v) => setRoute(v as string)}
            items={{ all: 'All routes', ...Object.fromEntries(codes.map((c) => [c, routeName(c, region)])) }}
          />
        )}
      </div>
      {!list ? (
        <Loader size="sm" />
      ) : (
        <>
          {hidden > 0 && (
            <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setEarlier(true)}>
              Show {hidden} earlier {kind} today
            </Button>
          )}
          {list.length ? (
            <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
              {list.map((d, i) => {
                const hour = groupOf(d)
                const newHour = i === 0 || groupOf(list[i - 1]) !== hour
                return (
                  <li key={d.key}>
                    {newHour && (
                      <div className="bg-kumo-recessed px-3 py-1 text-xs font-medium text-kumo-subtle">{hour}</div>
                    )}
                    <TimetableRow
                      trip={d.trip}
                      stop={d.stop}
                      live={live.get(d.trip)}
                      now={isToday ? now : null}
                      platform={stops?.get(region, d.stop.stopId)?.platform ?? null}
                      arriving={kind === 'arrivals'}
                      origin={kind === 'arrivals' ? originName(stops, d.trip) : null}
                      format={format}
                      onNavigate={onNavigate}
                    />
                  </li>
                )
              })}
            </ul>
          ) : (
            <Text variant="secondary">
              {filtered?.length ? `No more ${kind} today.` : `No ${kind} on ${dayLabel.format(Date.parse(date))}.`}
            </Text>
          )}
          <Text size="xs" variant="secondary">
            {kind === 'arrivals'
              ? "Arrivals are services that finish here or only set down here, at TransLink's published arrival times."
              : "Times are TransLink's published timetable."}
            {isToday && ' Where the real-time feed reports a service, its delay (+/− minutes) or cancellation is shown.'}
          </Text>
        </>
      )}
    </div>
  )
}

function routeName(code: string, region: TransitRegion) {
  const r = routeInfo(code, region)
  return r?.line ?? (r ? `${r.short} ${r.long}` : code)
}

function byRoute(a: string, b: string) {
  return a.localeCompare(b, 'en', { numeric: true })
}

function originName(stops: StopIndex | null, trip: ScheduledTrip) {
  const s = stops?.get(trip.region, trip.stops[0].stopId)
  return s ? stops!.station(s).name : null
}

function TimetableRow({
  trip,
  stop,
  live,
  now,
  platform,
  arriving,
  origin,
  format,
  onNavigate,
}: {
  trip: ScheduledTrip
  stop: ScheduledStop
  live: LiveTrip | null
  now: number | null
  platform: string | null
  /** An arrival (the trip ends or only sets down here), shown with where it came from. */
  arriving: boolean
  origin: string | null
  format: TimeFormat
  onNavigate: (hash: string) => void
}) {
  const info = routeInfo(trip.route, trip.region)
  const { rt, gone } = liveStop(live, stop)
  const scheduled = arriving ? stop.arrival : stop.time
  const reported = rt?.time ?? null
  const past = now != null && (reported ?? scheduled) < now - 60_000
  const delay = delayOf(reported, scheduled)
  // As in the TransLink app: "+0" only for a tracked vehicle; an untracked trip shows a delay only if one is reported.
  const showDelay = !gone && delay != null && (!!live?.vehicle || Math.abs(delay) >= 60)
  const countdown = format === 'minutes' && now != null && !past ? minutesUntil(reported ?? scheduled, now) : null
  const body = (
    <>
      <span
        className={`flex h-6 min-w-10 shrink-0 items-center justify-center rounded px-1.5 text-xs font-semibold ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
        style={info?.color ? { backgroundColor: info.color, color: readableTextOn(info.color) } : undefined}
      >
        {info?.line?.split(' ')[0] ?? info?.short ?? trip.route}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={`truncate text-sm ${past ? 'text-kumo-subtle' : ''}`}>
          {arriving ? `From ${origin ?? 'start of route'}` : `To ${trip.headsign}`}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-kumo-subtle">
          {platform && <span>Platform {platform}</span>}
          {stop.kind === 'pickup' && <StopKindBadge kind="pickup" />}
          {live?.cancelled ? (
            <span className="font-medium text-kumo-danger">Cancelled</span>
          ) : rt?.skipped ? (
            <span className="font-medium text-kumo-danger">Not stopping here</span>
          ) : live?.vehicle ? (
            <span className="inline-flex items-center gap-1 text-kumo-success">
              <BroadcastIcon size={12} weight="bold" /> Real-time
            </span>
          ) : null}
        </span>
      </span>
      <span className="grid shrink-0 justify-items-end gap-0.5 tabular-nums">
        <span className="inline-flex items-baseline gap-1.5">
          <span className={`font-medium ${gone ? 'text-kumo-subtle line-through' : past ? 'text-kumo-subtle' : ''}`}>
            {countdown ?? clock.format(scheduled)}
          </span>
          {showDelay && <DelayChip delay={delay} />}
        </span>
        {countdown && <span className="text-xs text-kumo-subtle">{clock.format(scheduled)}</span>}
      </span>
    </>
  )
  return live?.vehicle ? (
    <button
      type="button"
      title="Show this vehicle"
      onClick={() => onNavigate(`vehicle/${encodeURIComponent(live.vehicle!.id)}`)}
      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
    >
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-3 py-2">{body}</div>
  )
}

/** Header button that scrolls to a page's timetable section, so it's easy to find. */
export function TimetableLink({ target }: { target: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={<CalendarDotsIcon />}
      onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      Timetable
    </Button>
  )
}
