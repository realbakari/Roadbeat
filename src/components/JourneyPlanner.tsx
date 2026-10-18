import { Button, InputGroup, Loader, Select, Tabs, Text } from '@cloudflare/kumo'
import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  MapPinIcon,
  ShareNetworkIcon,
  StarIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Stop, StopIndex } from '../api/stops'
import { dayStart, routesAtStops, timetableDates } from '../api/timetables'
import { alertActive, routeInfo, type TransitAlert } from '../api/translink'
import type { LiveVehicle, TransitRegion } from '../api/transitTypes'
import { keepSavedTrip, removeSavedTrip, useSavedTrips } from '../lib/savedStops'
import { planHash, type PlanQuery } from '../lib/route'
import { filterJourneys, sameTrip, TRIP_MODES, tripFilter, type SavedTrip } from '../lib/savedTrips'
import { SavedTrips } from './SavedTrips'
import { useTripsOn } from '../hooks/useTimetable'
import { useNow } from '../hooks/useNow'
import { useStopIndex, useTimetableIndex, useTripUpdates } from '../hooks/useTransitFeeds'
import { stopHref } from '../lib/departures'
import { changeTime, legMode, planJourneys, searchStops, shortName, stopAndChildren, translinkPlannerUrl, type Journey, type Leg } from '../lib/planner'
import { liveLookup, type LiveLookup } from '../lib/timetable'
import { RouteBadges } from './TransitHome'
import { REGION_NAMES } from '../lib/transitRegions'
import { useCopied } from '../hooks/useCopied'
import { ExternalLink } from './ui/Links'
import { chipClass } from './chip'
import { brisbaneClock as clock, brisbaneDate } from '../lib/aest'

const dayLabel = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

const TIMES = Object.fromEntries(
  Array.from({ length: 24 * 12 }, (_, i) => {
    const h = Math.floor(i / 12)
    const m = (i % 12) * 5
    return [String(i * 5), `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`]
  }),
)

/** A "From" or "To" field that searches TransLink's stations and stops. */
export function StopField({
  label,
  value,
  onChange,
  stops,
}: {
  label: string
  value: Stop | null
  onChange: (s: Stop | null) => void
  stops: StopIndex | null
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const hits = useMemo(() => (stops && open ? searchStops(stops, text, 6) : []), [stops, text, open])
  return (
    <div className="relative grid gap-1">
      <Text size="xs" variant="secondary" bold>
        {label}
      </Text>
      <InputGroup>
        <InputGroup.Addon>
          <MapPinIcon />
        </InputGroup.Addon>
        <InputGroup.Input
          aria-label={label}
          placeholder="Station, stop or stop number"
          value={value ? value.name : text}
          onChange={(e) => {
            onChange(null)
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {(value || text) && (
          <InputGroup.Button
            variant="ghost"
            shape="square"
            aria-label={`Clear ${label}`}
            icon={<XIcon />}
            onClick={() => {
              onChange(null)
              setText('')
            }}
          />
        )}
      </InputGroup>
      {open && !value && text.trim().length >= 2 && (
        <ul className="absolute top-full right-0 left-0 z-30 mt-1 divide-y divide-kumo-line overflow-hidden rounded-lg bg-kumo-base shadow-lg ring ring-kumo-line">
          {!stops ? (
            <li className="px-3 py-2">
              <Loader size="sm" />
            </li>
          ) : hits.length ? (
            hits.map((s) => (
              <li key={s.region + s.id}>
                <button
                  type="button"
                  className="w-full truncate px-3 py-2 text-left hover:bg-kumo-tint"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(s)
                    setText('')
                    setOpen(false)
                  }}
                >
                  {s.name}
                  {/^\d+$/.test(s.id) && <span className="ml-2 text-xs text-kumo-subtle">Stop {s.id}</span>}
                  {s.region !== 'SEQ' && <span className="ml-2 text-xs text-kumo-subtle">{REGION_NAMES[s.region]}</span>}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-kumo-subtle">No matching station or stop</li>
          )}
        </ul>
      )}
    </div>
  )
}

/**
 * Journey planner, laid out like TransLink's, Transport Victoria's and
 * transportnsw.info's: from, to, day, leave after / arrive before. It plans
 * from TransLink's published timetable (exact times, with real-time today):
 * direct services and trips with one change at the same station or stop.
 * Trips that need a walk between stops go to TransLink's own planner with the
 * same search filled in.
 */
export function JourneyPlanner({
  vehicles,
  alerts,
  initial,
  onNavigate,
}: {
  vehicles: LiveVehicle[]
  /** TransLink service alerts, to flag disruptions on each option. */
  alerts: TransitAlert[] | null
  /** A search from the URL (a shared or saved trip). */
  initial?: PlanQuery
  onNavigate: (hash: string) => void
}) {
  const now = useNow(30_000)
  const stops = useStopIndex(true, true)
  const { index } = useTimetableIndex(true)
  const { updates } = useTripUpdates(true)
  const today = brisbaneDate(now)

  // Stops are kept by id so a search from the URL can name them before the stop list has loaded.
  type Ref = { region: TransitRegion; id: string }
  const [fromRef, setFromRef] = useState<Ref | null>(initial ? { region: initial.region, id: initial.from } : null)
  const [toRef, setToRef] = useState<Ref | null>(initial ? { region: initial.region, id: initial.to } : null)
  const from = (fromRef && stops?.get(fromRef.region, fromRef.id)) || null
  const to = (toRef && stops?.get(toRef.region, toRef.id)) || null
  const setFrom = (s: Stop | null) => setFromRef(s && { region: s.region, id: s.id })
  const dateRegion = fromRef?.region ?? 'SEQ'
  const dates = useMemo(() => (index ? timetableDates(index, dateRegion, today) : []), [index, dateRegion, today])
  const setTo = (s: Stop | null) => setToRef(s && { region: s.region, id: s.id })
  const [date, setDate] = useState<string | null>(initial?.date ?? null)
  const [arrive, setArrive] = useState(initial?.arrive ?? false)
  const [minutes, setMinutes] = useState<number | null>(initial?.minutes ?? null)
  // As in the TransLink app: which modes to use and how many changes.
  const [modes, setModes] = useState<Set<string>>(() => new Set(initial?.modes?.length ? initial.modes : TRIP_MODES))
  const [directOnly, setDirectOnly] = useState(initial?.direct ?? false)
  const savedTrips = useSavedTrips()
  const [shared, flashShared] = useCopied(2500)
  // Opens a saved trip here, from now, rather than through the URL, which may already name it.
  const openTrip = (t: SavedTrip) => {
    setFromRef({ region: t.region, id: t.from })
    setToRef({ region: t.region, id: t.to })
    setDate(null)
    setMinutes(null)
    setArrive(false)
    setModes(new Set(t.modes?.length ? t.modes : TRIP_MODES))
    setDirectOnly(!!t.direct)
  }
  const day = date && dates.includes(date) ? date : (dates[0] ?? today)
  // Until a time is picked, today searches from this minute (the picker shows it rounded down to 5).
  const nowMinutes = Math.floor((now - dayStart(today)) / 60_000)
  const at = minutes ?? (day === today ? nowMinutes : 8 * 60)
  const atLabel = String(Math.floor(at / 5) * 5)

  const region = from?.region ?? 'SEQ'
  const fromIds = useMemo(() => (stops && from ? stopAndChildren(stops, from) : null), [stops, from])
  const toIds = useMemo(() => (stops && to ? stopAndChildren(stops, to) : null), [stops, to])
  const codes = useMemo(() => {
    if (!index || !fromIds || !toIds || from?.region !== to?.region) return null
    // Routes from the origin (first ride) and to the destination (second ride).
    return [...new Set([...routesAtStops(index, region, fromIds), ...routesAtStops(index, region, toIds)])]
  }, [index, fromIds, toIds, from, to, region])
  const trips = useTripsOn(region, codes, from && to ? day : null, true)
  const live = useMemo(() => liveLookup(day === today ? updates : null, vehicles), [day, today, updates, vehicles])

  const all = useMemo(
    () => (trips && stops && fromIds && toIds ? planJourneys(trips, stops, fromIds, toIds) : null),
    [trips, stops, fromIds, toIds],
  )
  const allowed = useMemo(() => (all ? filterJourneys(all, { modes: [...modes], direct: directOnly }, legMode) : null), [all, directOnly, modes])
  const [more, setMore] = useState(0)
  const options = useMemo(() => {
    const all = allowed
    if (!all) return null
    const t = dayStart(day) + at * 60_000
    const n = 5 + more
    if (arrive)
      return all
        .filter((o) => o.arr <= t && o.dep >= dayStart(day))
        .sort((a, b) => a.arr - b.arr)
        .slice(-n)
    return all.filter((o) => o.dep >= t).slice(0, n)
  }, [allowed, day, at, arrive, more])

  const dayItems = Object.fromEntries(
    dates.map((d) => [d, d === today ? `Today, ${dayLabel.format(Date.parse(d))}` : dayLabel.format(Date.parse(d))]),
  )
  const plannerUrl = translinkPlannerUrl(from, to, day, at, arrive)
  const thisTrip = from && to ? { region: from.region, from: from.id, to: to.id, ...tripFilter(modes, directOnly) } : null
  const savedTrip = thisTrip ? savedTrips.find((t) => sameTrip(t, thisTrip)) : undefined
  // A saved trip whose modes or "direct only" differ from the planner's can be updated to them.
  const filterChanged = !!savedTrip && !!thisTrip && (savedTrip.modes?.join() !== thisTrip.modes?.join() || !!savedTrip.direct !== !!thisTrip.direct)
  const share = async () => {
    if (!from || !to) return
    const f = tripFilter(modes, directOnly)
    const hash = planHash({ region: from.region, from: from.id, to: to.id, date: day, minutes: at, arrive, modes: f.modes ?? null, direct: directOnly })
    const url = `${location.origin}${location.pathname}#${hash}`
    const title = `${from.name} to ${to.name}`
    try {
      if (navigator.share) await navigator.share({ title, url })
      else {
        await navigator.clipboard.writeText(url)
        flashShared()
      }
    } catch {
      // Share sheet dismissed.
    }
  }
  const journeyAlerts = (j: Journey) =>
    alerts?.filter(
      (a) => a.region === j.legs[0].trip.region && alertActive(a, j.dep) && j.legs.some((l) => a.routes.includes(l.trip.route)),
    ) ?? []

  return (
    <div className="grid gap-4 px-4 pt-4">
      <div className="grid gap-3 rounded-lg bg-kumo-base px-3 py-3 ring ring-kumo-line">
        <div className="flex items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-2">
            <StopField label="From" value={from} onChange={setFrom} stops={stops} />
            <StopField label="To" value={to} onChange={setTo} stops={stops} />
          </div>
          <Button
            variant="ghost"
            shape="square"
            aria-label="Swap from and to"
            icon={<ArrowsDownUpIcon />}
            onClick={() => {
              setFrom(to)
              setTo(from)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Tabs
            size="sm"
            className="w-full"
            listClassName="w-full [&>*]:flex-1"
            value={arrive ? 'arrive' : 'leave'}
            onValueChange={(v) => setArrive(v === 'arrive')}
            tabs={[
              { value: 'leave', label: 'Leave after' },
              { value: 'arrive', label: 'Arrive before' },
            ]}
          />
          <div className="flex gap-2">
            <Select aria-label="Day" size="sm" className="min-w-0 flex-1" value={day} onValueChange={(v) => setDate(v as string)} items={dayItems} />
            <Select aria-label="Time" size="sm" className="w-28 shrink-0" value={atLabel} onValueChange={(v) => setMinutes(Number(v))} items={TIMES} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TRIP_MODES.map((m) => {
            const on = modes.has(m)
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setModes((prev) => {
                    const next = new Set(prev)
                    if (on && next.size > 1) next.delete(m)
                    else next.add(m)
                    return next
                  })
                }
                className={chipClass(on, 'capitalize')}
              >
                {m}
              </button>
            )
          })}
          <span className="mx-1 h-4 w-px bg-kumo-line" aria-hidden />
          <button
            type="button"
            aria-pressed={directOnly}
            onClick={() => setDirectOnly((v) => !v)}
            className={chipClass(directOnly)}
          >
            Direct only
          </button>
        </div>
      </div>

      {(!from || !to) && <SavedTrips vehicles={vehicles} alerts={alerts} onNavigate={onNavigate} onOpen={openTrip} />}

      {from && to && savedTrips.length > 0 && stops && (
        <section className="grid gap-1.5">
          <Text size="xs" variant="secondary" bold>
            My trips
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {savedTrips.map((t) => {
              const a = stops.get(t.region, t.from)
              const b = stops.get(t.region, t.to)
              if (!a || !b) return null
              return (
                <button
                  key={`${t.from}>${t.to}`}
                  type="button"
                  onClick={() => openTrip(t)}
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm ring ring-kumo-line hover:bg-kumo-tint"
                >
                  <StarIcon size={12} weight="fill" className="text-kumo-warning" />
                  {t.name ?? `${shortName(a.name)} → ${shortName(b.name)}`}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {!from || !to ? (
        <Text size="sm" variant="secondary">
          Choose where you're leaving from and going to. Trips from TransLink's published timetable appear here, direct or
          with one change at the same station or stop, with real-time for today's services.
        </Text>
      ) : from.region === to.region && from.id === to.id ? (
        <Text variant="secondary">Pick two different stops.</Text>
      ) : !options ? (
        <Loader size="sm" />
      ) : (
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text as="h3" variant="heading">
              Your options
            </Text>
            <div className="flex gap-1">
              {filterChanged ? (
                <Button size="sm" variant="secondary" icon={<StarIcon weight="fill" />} onClick={() => thisTrip && keepSavedTrip(thisTrip)}>
                  Update saved trip
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={savedTrip ? 'secondary' : 'ghost'}
                  icon={<StarIcon weight={savedTrip ? 'fill' : 'regular'} />}
                  onClick={() => thisTrip && (savedTrip ? removeSavedTrip(thisTrip) : keepSavedTrip(thisTrip))}
                >
                  {savedTrip ? 'Saved' : 'Save this trip'}
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<ShareNetworkIcon />} onClick={share}>
                {shared ? 'Link copied' : 'Share'}
              </Button>
            </div>
          </div>
          {options.length ? (
            <ul className="grid gap-2">
              {options.map((o) => (
                <JourneyCard
                  key={o.key}
                  j={o}
                  alerts={journeyAlerts(o)}
                  live={live}
                  now={day === today ? now : null}
                  nextDay={dayStart(day) + 86_400_000}
                  stops={stops}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          ) : (
            <Text variant="secondary">
              {all?.length
                ? `No trips ${arrive ? 'arriving before' : 'leaving after'} ${clock.format(dayStart(day) + at * 60_000)} on ${dayLabel.format(Date.parse(day))}.`
                : "No trip on that day with at most one change at the same station or stop. It may need a walk between stops or more changes: TransLink's journey planner below can plan it."}
            </Text>
          )}
          {!options.length && !arrive && dates.indexOf(day) >= 0 && dates.indexOf(day) < dates.length - 1 && (
            <Button
              size="sm"
              variant="secondary"
              className="justify-self-start"
              onClick={() => {
                setDate(dates[dates.indexOf(day) + 1])
                setMinutes(0)
              }}
            >
              First trips on {dayLabel.format(Date.parse(dates[dates.indexOf(day) + 1]))}
            </Button>
          )}
          {options.length >= 5 + more && (
            <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setMore((n) => n + 5)}>
              {arrive ? 'Earlier' : 'Later'} trips
            </Button>
          )}
        </section>
      )}

      <div className="grid gap-1 rounded-lg p-3 ring ring-kumo-line">
        <Text bold>Need a walk between stops, more changes or fares?</Text>
        <Text size="sm" variant="secondary">
          TransLink's journey planner plans door-to-door trips with walking, any number of changes and fares.
          {from || to ? ' Your search is filled in.' : ''}
        </Text>
        <ExternalLink href={plannerUrl}>Open in TransLink journey planner</ExternalLink>
      </div>
    </div>
  )
}

function minutesText(ms: number) {
  const m = Math.round(ms / 60_000)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`
}

/** One journey: its rides, the change between them, and what the real-time feed reports. */
function JourneyCard({
  j,
  alerts,
  live,
  now,
  nextDay,
  stops,
  onNavigate,
}: {
  j: Journey
  /** Service alerts in effect on this journey's routes when it leaves. */
  alerts: TransitAlert[]
  live: LiveLookup
  now: number | null
  /** Midnight ending the searched day: later times are marked as the next day. */
  nextDay: number
  stops: StopIndex | null
  onNavigate: (hash: string) => void
}) {
  const [open, setOpen] = useState(false)
  const lives = j.legs.map((l) => live.get(l.trip))
  const reported = j.legs.map((l, i) => ({
    dep: lives[i]?.stopTime(l.from)?.time ?? null,
    arr: lives[i]?.stopTime(l.to)?.time ?? null,
  }))
  const cancelled = lives.some((l) => l?.cancelled)
  const first = j.legs[0]
  const last = j.legs[j.legs.length - 1]
  const dep = reported[0].dep ?? first.from.time
  const inMin = now != null ? Math.round((dep - now) / 60_000) : null
  const change = changeTime(j)
  // Real-time check on the connection: the first ride's reported arrival against the second's reported departure.
  const connection =
    j.legs.length > 1 && (reported[0].arr != null || reported[1].dep != null)
      ? (reported[1].dep ?? j.legs[1].from.time) - (reported[0].arr ?? first.to.arrival)
      : null
  const at = j.legs.length > 1 ? stops?.get(first.trip.region, first.to.stopId) : null
  const changePlace = at ? stops!.station(at).name : null
  const platform = (id: string) => stops?.get(first.trip.region, id)?.platform ?? null
  const late = (rt: number | null, t: number) => rt != null && Math.abs(rt - t) >= 60_000

  return (
    <li className={`overflow-hidden rounded-lg ring ring-kumo-line ${cancelled ? 'opacity-70' : ''}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="grid w-full gap-1.5 px-3 py-2.5 text-left hover:bg-kumo-tint">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm tabular-nums">
            <span className={`font-semibold ${cancelled ? 'line-through' : ''}`}>{clock.format(j.dep)}</span>
            <span className="text-kumo-subtle"> → </span>
            <span className={`font-semibold ${cancelled ? 'line-through' : ''}`}>{clock.format(j.arr)}</span>
            {j.arr >= nextDay && <span className="ml-1.5 text-xs text-kumo-subtle">next day</span>}
          </span>
          <span className="flex items-center gap-2 text-sm text-kumo-subtle tabular-nums">
            {minutesText(j.arr - j.dep)}
            {open ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          {j.legs.map((l, i) => {
            const info = routeInfo(l.trip.route, l.trip.region)
            return (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <CaretRightIcon size={12} className="text-kumo-subtle" />}
                <RouteBadges routes={info ? [{ label: info.line ?? info.short, color: info.color, mode: info.mode }] : []} />
              </span>
            )
          })}
          <span className="min-w-0 truncate text-kumo-subtle">
            {j.legs.length === 1
              ? `towards ${shortName(first.trip.headsign)}`
              : `change at ${changePlace ? shortName(changePlace) : 'stop'}, ${minutesText(change)}`}
          </span>
        </div>
        {alerts.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-kumo-warning">
            <WarningIcon size={14} weight="fill" className="mt-px shrink-0" />
            <span className="min-w-0">
              {alerts[0].header}
              {alerts.length > 1 ? ` (+${alerts.length - 1} more)` : ''}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 text-xs text-kumo-subtle">
          {platform(first.from.stopId) && <span>Platform {platform(first.from.stopId)}</span>}
          {cancelled ? (
            <span className="font-medium text-kumo-danger">A service on this trip is cancelled</span>
          ) : (
            <>
              {late(reported[0].dep, first.from.time) && (
                <span className={reported[0].dep! > first.from.time ? 'text-kumo-warning' : 'text-kumo-info'}>
                  Departs {clock.format(reported[0].dep!)}
                </span>
              )}
              {late(reported[j.legs.length - 1].arr, last.to.time) && (
                <span className={reported[j.legs.length - 1].arr! > last.to.time ? 'text-kumo-warning' : 'text-kumo-info'}>
                  Arrives {clock.format(reported[j.legs.length - 1].arr!)}
                </span>
              )}
              {connection != null && connection < 60_000 && (
                <span className="font-medium text-kumo-danger">Connection at risk: reported times leave no time to change</span>
              )}
              {lives[0]?.vehicle && !late(reported[0].dep, first.from.time) && <span className="text-kumo-success">Real-time · on time</span>}
              {inMin != null && inMin >= 0 && inMin < 120 && <span>{inMin === 0 ? 'Leaving now' : `in ${inMin} min`}</span>}
            </>
          )}
        </div>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-kumo-line px-3 py-2 text-sm">
          {j.legs.map((l, i) => (
            <div key={i} className="grid gap-1">
              {i > 0 && (
                <div className="my-1 rounded-md bg-kumo-recessed px-2 py-1.5 text-xs">
                  <span className="font-medium">Change at {changePlace ?? 'this stop'}</span>: arrive{' '}
                  {clock.format(first.to.arrival)}
                  {platform(first.to.stopId) ? ` on platform ${platform(first.to.stopId)}` : ''}, next service leaves{' '}
                  {clock.format(l.from.time)}
                  {platform(l.from.stopId) ? ` from platform ${platform(l.from.stopId)}` : ''} — {minutesText(change)} to change.
                </div>
              )}
              <LegStops leg={l} stops={stops} onNavigate={onNavigate} />
            </div>
          ))}
          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onNavigate(`transit/alert/${encodeURIComponent(a.id)}`)}
              className="flex items-start gap-1.5 rounded-md bg-kumo-recessed px-2 py-1.5 text-left text-xs hover:bg-kumo-tint"
            >
              <WarningIcon size={14} weight="fill" className="mt-px shrink-0 text-kumo-warning" />
              <span>
                <span className="font-medium">{a.header}</span> · {a.effect}
              </span>
            </button>
          ))}
          <p className="text-xs text-kumo-subtle">
            Times are TransLink's published timetable{j.legs.length > 1 ? '; the change time is the gap between them' : ''}.
          </p>
        </div>
      )}
    </li>
  )
}

function LegStops({ leg, stops, onNavigate }: { leg: Leg; stops: StopIndex | null; onNavigate: (hash: string) => void }) {
  const info = routeInfo(leg.trip.route, leg.trip.region)
  const list = leg.trip.stops.slice(leg.fromIndex, leg.toIndex + 1)
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-kumo-subtle">
        <RouteBadges routes={info ? [{ label: info.line ?? info.short, color: info.color, mode: info.mode }] : []} />
        <span>
          {info?.long} · towards {shortName(leg.trip.headsign)}
        </span>
      </div>
      <ol className="grid gap-0.5">
        {list.map((s, i) => {
          const st = stops?.get(leg.trip.region, s.stopId)
          const station = st ? stops!.station(st) : null
          const end = i === 0 || i === list.length - 1
          const time = i === list.length - 1 ? s.arrival : s.time
          return (
            <li key={i} className="flex items-center justify-between gap-2">
              <button
                type="button"
                className={`truncate text-left hover:underline ${end ? 'font-medium' : 'text-kumo-subtle'}`}
                onClick={() => onNavigate(stopHref(leg.trip.region, station?.id ?? s.stopId))}
              >
                {station?.name ?? `Stop ${s.stopId}`}
                {end && st?.platform ? `, platform ${st.platform}` : ''}
              </button>
              <span className={`shrink-0 tabular-nums ${end ? 'font-medium' : 'text-kumo-subtle'}`}>{clock.format(time)}</span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

