import { Button, InputGroup, Loader, Text } from '@cloudflare/kumo'
import { ArrowDownIcon, ArrowUpIcon, CaretRightIcon, PathIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { StopIndex } from '../api/stops'
import { brisbaneDate, routesAtStops, type TimetableIndex } from '../api/timetables'
import { alertActive, routeInfo, type LiveVehicle, type TransitAlert, type TripUpdates } from '../api/translink'
import { useTripsOn } from '../hooks/useTimetable'
import { useNow, useStopIndex, useTimetableIndex, useTripUpdates } from '../hooks/useTrafficData'
import { planJourneys, stopAndChildren, type Journey } from '../lib/planner'
import { planHash } from '../lib/route'
import { moveSavedTrip, removeSavedTrip, renameSavedTrip, useSavedTrips } from '../lib/savedStops'
import { filterJourneys, nextJourneys, type SavedTrip } from '../lib/savedTrips'
import { delayOf, minutesUntil } from '../lib/timeFormat'
import { liveLookup, type LiveLookup } from '../lib/timetable'
import { readableTextOn } from '../lib/routeColor'

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })
const seconds = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit', second: '2-digit' })
const short = (t: number) => clock.format(t).replace(/\s/g, '')

/** How many departures each card lists, as TripView's home screen does. */
const SHOWN = 4

const shortName = (name: string) => name.replace(/ station$/i, '')
const modeOf = (l: Journey['legs'][number]) => routeInfo(l.trip.route, l.trip.region)?.mode ?? 'bus'

/** The planner search a saved trip opens: from now, with its saved filters. */
const savedTripHash = (t: SavedTrip) =>
  planHash({ region: t.region, from: t.from, to: t.to, date: null, minutes: null, arrive: false, modes: t.modes ?? null, direct: !!t.direct })

/**
 * "My trips", as on TripView's home screen: each saved trip with its next
 * departures from TransLink's published timetable and the real-time delay
 * where the feed reports one. Tapping a trip opens it in the planner.
 */
export function SavedTrips({
  vehicles,
  alerts,
  onNavigate,
  onOpen = (t) => onNavigate(savedTripHash(t)),
  hint,
}: {
  vehicles: LiveVehicle[]
  /** TransLink service alerts, shown on the trips whose routes they affect. */
  alerts: TransitAlert[] | null
  onNavigate: (hash: string) => void
  /** Opens a trip's full planner result; by default through its planner link. */
  onOpen?: (t: SavedTrip) => void
  /** Shown when nothing is saved; with none, the section is left out. */
  hint?: string
}) {
  const saved = useSavedTrips()
  const any = saved.length > 0
  const stops = useStopIndex(any, saved.some((t) => /^\d+$/.test(t.from) || /^\d+$/.test(t.to)))
  const { index } = useTimetableIndex(any)
  const { updates } = useTripUpdates(any)
  const now = useNow(15_000)
  const [editing, setEditing] = useState(false)
  if (!any && !hint) return null

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PathIcon size={18} weight="bold" className="text-kumo-subtle" />
          <Text as="h3" variant="heading">
            My trips
          </Text>
        </div>
        {any && (
          <button type="button" className="text-sm text-kumo-link hover:underline" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      {!any ? (
        <Text size="sm" variant="secondary">
          {hint}
        </Text>
      ) : !stops || !index ? (
        <Loader size="sm" />
      ) : (
        <ul className="grid gap-2">
          {saved.map((t, i) => (
            <TripCard
              key={`${t.region}/${t.from}>${t.to}`}
              t={t}
              first={i === 0}
              last={i === saved.length - 1}
              editing={editing}
              stops={stops}
              index={index}
              updates={updates}
              vehicles={vehicles}
              alerts={alerts}
              now={now}
              onOpen={onOpen}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
      {any && updates && (
        <Text size="xs" variant="secondary">
          Published timetable, with TransLink real-time
          {[...new Set(saved.map((t) => t.region))].map((r) => updates.at[r] && ` updated at ${seconds.format(updates.at[r])}`)}.
        </Text>
      )}
    </section>
  )
}

function TripCard({
  t,
  first,
  last,
  editing,
  stops,
  index,
  updates,
  vehicles,
  alerts,
  now,
  onOpen,
  onNavigate,
}: {
  t: SavedTrip
  first: boolean
  last: boolean
  editing: boolean
  stops: StopIndex
  index: TimetableIndex
  updates: TripUpdates | null
  vehicles: LiveVehicle[]
  alerts: TransitAlert[] | null
  now: number
  onOpen: (t: SavedTrip) => void
  onNavigate: (hash: string) => void
}) {
  const from = stops.get(t.region, t.from)
  const to = stops.get(t.region, t.to)
  const today = brisbaneDate(now)
  const fromIds = useMemo(() => (from ? stopAndChildren(stops, from) : null), [stops, from])
  const toIds = useMemo(() => (to ? stopAndChildren(stops, to) : null), [stops, to])
  const codes = useMemo(
    () => (fromIds && toIds ? [...new Set([...routesAtStops(index, t.region, fromIds), ...routesAtStops(index, t.region, toIds)])] : null),
    [index, t.region, fromIds, toIds],
  )
  const trips = useTripsOn(t.region, codes, today, true)
  const live = useMemo(() => liveLookup(updates, vehicles), [updates, vehicles])
  const journeys = useMemo(
    () => (trips && fromIds && toIds ? filterJourneys(planJourneys(trips, stops, fromIds, toIds), t, modeOf) : null),
    [trips, stops, fromIds, toIds, t],
  )
  const reportedDep = (j: Journey) => live.get(j.legs[0].trip)?.stopTime(j.legs[0].from)?.time ?? null
  const next = journeys ? nextJourneys(journeys, now, SHOWN, reportedDep) : null

  const title = t.name ?? (from && to ? `${shortName(from.name)} to ${shortName(to.name)}` : 'Saved trip')
  const filterText = [t.modes?.join(', '), t.direct && 'direct only'].filter(Boolean).join(' · ')
  const filter = filterText.charAt(0).toUpperCase() + filterText.slice(1)
  const [draft, setDraft] = useState(t.name ?? '')

  if (editing)
    return (
      <li className="grid min-w-0 gap-2 rounded-lg px-3 py-2.5 ring ring-kumo-line">
        <InputGroup>
          <InputGroup.Input
            aria-label="Trip name"
            placeholder={from && to ? `${shortName(from.name)} to ${shortName(to.name)}` : 'Trip name'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => renameSavedTrip(t, draft)}
            onKeyDown={(e) => e.key === 'Enter' && renameSavedTrip(t, draft)}
          />
        </InputGroup>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" shape="square" aria-label="Move up" icon={<ArrowUpIcon />} disabled={first} onClick={() => moveSavedTrip(t, -1)} />
          <Button size="sm" variant="ghost" shape="square" aria-label="Move down" icon={<ArrowDownIcon />} disabled={last} onClick={() => moveSavedTrip(t, 1)} />
          <span className="flex-1" />
          <Button size="sm" variant="ghost" icon={<TrashIcon />} onClick={() => removeSavedTrip(t)}>
            Remove
          </Button>
        </div>
      </li>
    )

  const tripAlerts =
    alerts?.filter((a) => a.region === t.region && alertActive(a, now) && next?.some((j) => j.legs.some((l) => a.routes.includes(l.trip.route)))) ?? []
  // As on TripView, the card is edged in the colour of the line it next leaves on.
  const edge = next?.[0] ? routeInfo(next[0].legs[0].trip.route, t.region)?.color : null

  return (
    <li className="min-w-0 overflow-hidden rounded-lg ring ring-kumo-line" style={edge ? { boxShadow: `inset 4px 0 0 ${edge}` } : undefined}>
      <button type="button" onClick={() => onOpen(t)} className="grid w-full min-w-0 text-left hover:bg-kumo-tint">
        <span className="flex items-center gap-2 py-2 pr-3 pl-4">
          <span className="grid min-w-0 flex-1 leading-tight">
            {t.name && <span className="truncate text-sm font-semibold text-kumo-strong">{t.name}</span>}
            {from && to ? (
              <span className={`truncate ${t.name ? 'text-xs text-kumo-subtle' : 'text-sm font-semibold text-kumo-strong'}`}>
                {shortName(from.name)} → {shortName(to.name)}
              </span>
            ) : (
              <span className="text-sm font-semibold text-kumo-strong">{title}</span>
            )}
            {filter && <span className="truncate text-xs text-kumo-subtle">{filter}</span>}
          </span>
          <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" />
        </span>
        {!from || !to ? (
          <span className="px-4 pb-2.5 text-sm text-kumo-subtle">This stop is no longer in TransLink's published stop list.</span>
        ) : !next ? (
          <span className="px-4 pb-2.5">
            <Loader size="sm" />
          </span>
        ) : next.length ? (
          <span className="grid min-w-0 divide-y divide-kumo-line border-t border-kumo-line">
            {next.map((j) => (
              <JourneyLine key={j.key} j={j} live={live} stops={stops} now={now} />
            ))}
          </span>
        ) : (
          <span className="px-4 pb-2.5 text-sm text-kumo-subtle">
            No more trips today in the published timetable, direct or with one change at the same station or stop. Open it for later days.
          </span>
        )}
      </button>
      {tripAlerts.length > 0 && (
        <button
          type="button"
          onClick={() => onNavigate(`transit/alert/${encodeURIComponent(tripAlerts[0].id)}`)}
          className="flex w-full items-start gap-2 border-t border-kumo-line bg-kumo-warning/10 py-2 pr-3 pl-4 text-left text-sm hover:bg-kumo-tint"
        >
          <WarningIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-kumo-warning" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-medium">{tripAlerts[0].header}</span>
            {tripAlerts.length > 1 && <span className="text-xs text-kumo-subtle">and {tripAlerts.length - 1} more TransLink service alerts on these routes</span>}
          </span>
          <CaretRightIcon size={14} className="mt-1 shrink-0 text-kumo-inactive" />
        </button>
      )}
    </li>
  )
}

/**
 * One departure on a trip card, laid out like TripView's: minutes to go in a
 * block of the line's colour, then the boarding platform and published
 * departure, and the published arrival with the route on the right.
 */
function JourneyLine({ j, live, stops, now }: { j: Journey; live: LiveLookup; stops: StopIndex; now: number }) {
  const first = j.legs[0]
  const last = j.legs[j.legs.length - 1]
  const tracked = live.get(first.trip)
  const reported = tracked?.stopTime(first.from)?.time ?? null
  const delay = delayOf(reported, first.from.time)
  const late = delay != null ? Math.round(delay / 60) : null
  const cancelled = j.legs.some((l) => live.get(l.trip)?.cancelled)
  const realtime = !!tracked?.vehicle
  const countdown = minutesUntil(reported ?? j.dep, now)
  const info = routeInfo(first.trip.route, first.trip.region)
  const platform = stops.get(first.trip.region, first.from.stopId)?.platform
  const dest = stops.get(last.trip.region, last.to.stopId)
  const label = (l: Journey['legs'][number]) => {
    const r = routeInfo(l.trip.route, l.trip.region)
    return r?.line?.split(' ')[0] ?? r?.short ?? l.trip.route
  }
  // "On time" only when a vehicle is tracked: an untracked zero delay is a schedule, not an observation.
  const status = cancelled
    ? { text: 'Cancelled', tone: 'text-kumo-danger', dot: 'bg-kumo-danger' }
    : realtime
      ? late === 0 || late == null
        ? { text: 'Real-time · on time', tone: 'text-kumo-success', dot: 'bg-kumo-success' }
        : { text: `Real-time · ${Math.abs(late)} min ${late > 0 ? 'late' : 'early'}`, tone: late > 0 ? 'text-kumo-danger' : 'text-kumo-info', dot: 'bg-kumo-success' }
      : late
        ? { text: `Scheduled · reported ${Math.abs(late)} min ${late > 0 ? 'late' : 'early'}`, tone: 'text-kumo-warning', dot: 'ring-2 ring-kumo-line ring-inset' }
        : { text: 'Scheduled', tone: 'text-kumo-subtle', dot: 'ring-2 ring-kumo-line ring-inset' }
  return (
    <span className="flex min-w-0 items-stretch tabular-nums">
      <span
        className={`flex w-16 shrink-0 items-center justify-center px-1 text-center font-semibold ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'} ${cancelled ? 'line-through opacity-60' : ''}`}
        style={info?.color ? { backgroundColor: info.color, color: readableTextOn(info.color) } : undefined}
      >
        {countdown ? (
          countdown === 'Now' ? (
            <span className="text-base">Now</span>
          ) : (
            <span>
              <span className="text-lg">{countdown.replace(' min', '')}</span>
              <span className="text-xs"> min</span>
            </span>
          )
        ) : (
          <span className="text-sm">{short(j.dep)}</span>
        )}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5 py-1.5 pr-3 pl-2.5">
        <span className="flex items-baseline justify-between gap-2 text-xs text-kumo-subtle">
          <span className="truncate">{platform ? `Platform ${platform}` : shortName(stops.get(first.trip.region, first.from.stopId)?.name ?? '')}</span>
          <span className="shrink-0 truncate">{dest ? shortName(stops.station(dest).name) : ''}</span>
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className={`text-base font-semibold text-kumo-strong ${cancelled ? 'line-through' : ''}`}>{clock.format(j.dep)}</span>
          <span className="text-base font-semibold text-kumo-strong">{clock.format(j.arr)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 text-xs">
          <span className={`inline-flex min-w-0 items-center gap-1.5 ${status.tone}`}>
            <span className={`size-2 shrink-0 rounded-sm ${status.dot}`} />
            <span className="truncate">{status.text}</span>
          </span>
          <span className="shrink-0 text-kumo-subtle">{j.legs.map(label).join(' › ')}</span>
        </span>
      </span>
    </span>
  )
}
