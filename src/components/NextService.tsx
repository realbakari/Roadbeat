import { BroadcastIcon, CalendarBlankIcon, CaretRightIcon } from '@phosphor-icons/react'
import type { StopIndex } from '../api/stops'
import { routeInfo, routeLabel } from '../api/translink'
import type { Departure } from '../lib/departures'
import { readableTextOn } from '../lib/routeColor'
import { minutesUntil } from '../lib/timeFormat'
import { tripHref } from '../lib/trip'
import { DelayChip } from './Realtime'
import { brisbaneClock as clock } from '../lib/aest'

/**
 * The next service from a stop, given a card of its own above the rest, as on
 * Transit Pulse's route page: the scheduled clock time large, minutes to go
 * beside it, then the route, platform and whether Translink is tracking it.
 */
export function NextService({ d, now, stops, onNavigate }: { d: Departure; now: number; stops: StopIndex | null; onNavigate: (hash: string) => void }) {
  const info = routeInfo(d.trip.route, d.trip.region)
  const platform = stops?.get(d.trip.region, d.stopId)?.platform
  const countdown = minutesUntil(d.time, now)
  const showDelay = d.delay != null && (d.vehicle != null || Math.abs(d.delay) >= 60)
  return (
    <button
      type="button"
      title="This service's stops"
      onClick={() => onNavigate(tripHref(d.trip.region, d.trip.tripId, d.trip.route))}
      className="grid w-full gap-2 rounded-lg px-4 py-3 text-left ring ring-kumo-line hover:bg-kumo-tint"
      style={info?.color ? { boxShadow: `inset 4px 0 0 ${info.color}` } : undefined}
    >
      <span className="flex items-baseline justify-between gap-3 tabular-nums">
        <span className="grid">
          <span className="text-xs font-medium text-kumo-subtle">Next service</span>
          <span className="inline-flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-kumo-strong">{clock.format(d.scheduled ?? d.time)}</span>
            {showDelay && <DelayChip delay={d.delay} />}
          </span>
        </span>
        {countdown && <span className="text-2xl font-semibold text-kumo-strong">{countdown}</span>}
      </span>
      <span className="flex items-center gap-2">
        <span
          className={`flex h-6 min-w-10 shrink-0 items-center justify-center rounded px-1.5 text-xs font-semibold ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
          style={info?.color ? { backgroundColor: info.color, color: readableTextOn(info.color) } : undefined}
        >
          {info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{d.headsign ? `To ${d.headsign}` : (info?.long || routeLabel(d.trip.route, d.trip.region))}</span>
        <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" />
      </span>
      <span className="flex flex-wrap items-center gap-x-3 text-xs text-kumo-subtle">
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
        {d.trip.relationship === 'added' && <span>Extra service</span>}
      </span>
    </button>
  )
}
