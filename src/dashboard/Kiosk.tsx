import { BroadcastIcon, CalendarBlankIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { routeInfo, routeLabel } from '../api/translink'
import type { TransitRegion } from '../api/transitTypes'
import { useLiveVehicles, useStopIndex, useTripIndex, useTripUpdates } from '../hooks/useTransitFeeds'
import { useNow } from '../hooks/useNow'
import { departuresAt, type Departure } from '../lib/departures'
import { isStale } from '../lib/feedAge'
import { readableTextOn } from '../lib/routeColor'
import { brisbaneClock as clock } from '../lib/aest'

function dueLabel(d: Departure, now: number) {
  const m = Math.round((d.time - now) / 60_000)
  return m <= 0 ? 'Now' : m < 60 ? `${m} min` : clock.format(d.time)
}

function Status({ d }: { d: Departure }) {
  if (d.trip.relationship === 'cancelled') return <span className="font-semibold text-kumo-danger">Cancelled</span>
  // "On time" only when a vehicle is tracked; otherwise the feed's delay is just the timetable.
  if (!d.vehicle) {
    return (
      <span className="inline-flex items-center gap-1.5 text-kumo-subtle">
        <CalendarBlankIcon aria-hidden /> Scheduled
      </span>
    )
  }
  const m = d.delay == null ? null : Math.round(d.delay / 60)
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${m ? 'text-kumo-danger' : 'text-kumo-success'}`}>
      <BroadcastIcon aria-hidden weight="bold" />
      {m == null || m === 0 ? 'On time' : m > 0 ? `${m} min late` : `${-m} min early`}
    </span>
  )
}

/**
 * Large, self-refreshing departure board for one stop or station, at
 * /kiosk/<region>/<stop id>, for a screen in a lobby or café. Times are
 * Translink's real-time feed, which lists services running now or starting soon.
 */
export function Kiosk({ region, stopId }: { region: TransitRegion; stopId: string }) {
  const now = useNow(10_000)
  const stops = useStopIndex(true, true)
  const trips = useTripIndex(true)
  const { updates, error, fetchedAt, failing } = useTripUpdates(true)
  const lastRead = fetchedAt[region] ?? null
  const stale = isStale(lastRead, failing.has(region), now)
  const { vehicles } = useLiveVehicles(true)
  const stop = stops?.get(region, stopId) ?? null

  const departures = useMemo(() => {
    if (!updates || !stops || !stop) return null
    const ids = new Set([stop.id, ...stops.children(stop).map((c) => c.id)])
    return departuresAt({ updates, vehicles, trips, now }, region, ids, 12)
  }, [updates, vehicles, trips, now, stops, stop, region])

  const [clockNow, setClockNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setClockNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (stop) document.title = `${stop.name} departures · Roadbeat`
  }, [stop])

  return (
    <div className="flex h-full flex-col bg-kumo-canvas">
      <header className="flex items-center gap-4 border-b border-kumo-line bg-kumo-base px-6 py-4 lg:px-10 lg:py-6">
        <img src="/favicon.svg" alt="" className="size-10 lg:size-12" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h1 className="truncate text-2xl font-semibold text-kumo-strong lg:text-4xl">{stop?.name ?? (stops ? 'Stop not found' : 'Loading…')}</h1>
          <p className="text-sm text-kumo-subtle lg:text-base">Next departures · Translink real-time</p>
        </div>
        <span className="text-3xl font-semibold text-kumo-strong tabular-nums lg:text-5xl">{clock.format(clockNow)}</span>
      </header>

      {stale && lastRead != null && (
        <p role="status" className="flex items-center gap-2 bg-kumo-warning-tint px-6 py-3 text-lg text-kumo-default lg:px-10">
          <WarningIcon className="shrink-0 text-kumo-warning" weight="fill" aria-hidden />
          Translink real-time is not answering. Times shown are from {clock.format(lastRead)}.
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-hidden px-6 lg:px-10">
        {stops && !stop ? (
          <p className="py-10 text-lg text-kumo-subtle">
            There's no stop "{stopId}" in Translink's published stops. Check the link, or open a stop in Roadbeat and choose Kiosk display.
          </p>
        ) : error && !updates ? (
          <p className="py-10 text-lg text-kumo-subtle">Couldn't reach Translink real-time. Trying again shortly.</p>
        ) : !departures ? (
          <p className="py-10 text-lg text-kumo-subtle">Loading departures…</p>
        ) : !departures.length ? (
          <p className="py-10 text-lg text-kumo-subtle">No services in Translink's real-time feed for this stop right now.</p>
        ) : (
          <ul className="divide-y divide-kumo-line">
            {departures.map((d) => {
              const info = routeInfo(d.trip.route, d.trip.region)
              const platform = stops?.get(d.trip.region, d.stopId)?.platform
              const cancelled = d.trip.relationship === 'cancelled'
              return (
                <li key={d.key} className={`flex items-center gap-4 py-3 lg:gap-6 lg:py-4 ${cancelled ? 'opacity-60' : ''}`}>
                  <span
                    className={`flex h-10 min-w-16 shrink-0 items-center justify-center rounded-lg px-2 text-lg font-semibold lg:h-14 lg:min-w-24 lg:text-2xl ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
                    style={info?.color ? { backgroundColor: info.color, color: readableTextOn(info.color) } : undefined}
                  >
                    {info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className={`truncate text-xl font-medium lg:text-3xl ${cancelled ? 'line-through' : ''}`}>
                      {d.headsign ?? info?.long ?? routeLabel(d.trip.route, d.trip.region)}
                    </span>
                    <span className="flex flex-wrap gap-x-4 text-sm lg:text-lg">
                      {platform && <span className="text-kumo-subtle">Platform {platform}</span>}
                      <Status d={d} />
                    </span>
                  </span>
                  <span className="grid shrink-0 justify-items-end">
                    <span className="text-2xl font-semibold tabular-nums lg:text-4xl">{cancelled ? '—' : dueLabel(d, now)}</span>
                    <span className="text-sm text-kumo-subtle tabular-nums lg:text-lg">{clock.format(d.scheduled ?? d.time)} scheduled</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-kumo-line bg-kumo-base px-6 py-3 text-sm text-kumo-subtle lg:px-10">
        <span>
          <BroadcastIcon className="inline align-text-bottom text-kumo-success" aria-hidden /> Live: a vehicle on that trip is reporting its position.
          Scheduled: not tracked yet.
        </span>
        <span>
          {lastRead != null && <>Updated {clock.format(lastRead)} · </>}Roadbeat · Data from Translink, CC BY 4.0
        </span>
      </footer>
    </div>
  )
}
