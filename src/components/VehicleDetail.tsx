import { Badge, Button, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, CrosshairIcon, BellIcon, BellRingingIcon, BoatIcon, BusIcon, TrainIcon, TramIcon, type Icon } from '@phosphor-icons/react'
import { alertActive, routeInfo, type TransitAlert } from '../api/translink'
import type { LiveVehicle, VehicleMode } from '../api/transitTypes'
import { useStopIndex, useTripIndex } from '../hooks/useTransitFeeds'
import { stopHref } from '../lib/departures'
import { tripHref } from '../lib/trip'
import { VEHICLE_COLOR } from '../lib/mapIcons'
import { REGION_NAMES } from '../lib/transitRegions'
import { NewTabNote } from './NewTabNote'
import { RelativeTime } from './ui/RelativeTime'

const MODE: Record<VehicleMode, { label: string; icon: Icon }> = {
  bus: { label: 'Bus', icon: BusIcon },
  train: { label: 'Train', icon: TrainIcon },
  tram: { label: 'Tram', icon: TramIcon },
  ferry: { label: 'Ferry', icon: BoatIcon },
}

const STATUS: Record<NonNullable<LiveVehicle['status']>, string> = {
  stopped: 'Stopped at',
  arriving: 'Arriving at',
  moving: 'On the way to',
}

interface Props {
  vehicle: LiveVehicle | null
  alerts: TransitAlert[] | null
  watchedRoutes: string[]
  now: number
  onBack: () => void
  onToggleWatch: (route: string) => void
  onOpenAlert: (id: string) => void
  /** Opens an app hash, e.g. a stop page. */
  onOpenHref: (hash: string) => void
  following: boolean
  onToggleFollow: () => void
}

/** A live TransLink vehicle picked on the map. */
export function VehicleDetail({
  vehicle: v,
  alerts,
  watchedRoutes,
  now,
  onBack,
  onToggleWatch,
  onOpenAlert,
  onOpenHref,
  following,
  onToggleFollow,
}: Props) {
  const stops = useStopIndex(!!v?.stopId, v?.mode === 'bus')
  const trips = useTripIndex(!!v?.tripId)
  const back = (
    <div className="flex items-center justify-between border-b border-kumo-line px-2 py-2">
      <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
        Back
      </Button>
      {v && (
        <Button
          variant={watching(v) ? 'secondary' : 'ghost'}
          size="sm"
          icon={watching(v) ? <BellRingingIcon weight="fill" /> : <BellIcon />}
          onClick={() => onToggleWatch(v.route)}
        >
          {watching(v) ? 'Watching route' : 'Watch route'}
        </Button>
      )}
    </div>
  )
  function watching(x: LiveVehicle) {
    return watchedRoutes.some((r) => r.toLowerCase() === x.route.toLowerCase())
  }

  if (!v) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {back}
        <div className="px-4 py-6">
          <Text variant="secondary">This vehicle isn't reporting its position any more. It may have finished its trip.</Text>
        </div>
      </div>
    )
  }

  const m = MODE[v.mode]
  const I = m.icon
  const stop = stops?.get(v.region, v.stopId) ?? null
  const headsign = trips?.get(v.region, v.tripId)?.headsign ?? null
  const routeAlerts = (alerts ?? []).filter((a) => a.routes.includes(v.route) && alertActive(a, now))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {back}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: v.color ?? VEHICLE_COLOR[v.mode] }}
              aria-hidden
            >
              <I size={22} weight="fill" />
            </span>
            <div className="grid min-w-0 gap-0.5">
              <Text as="h2" variant="heading" size="lg">
                {v.mode === 'train' ? (v.lineName ?? `Train ${v.route}`) : `${m.label} ${routeInfo(v.route, v.region)?.short ?? v.route}`}
              </Text>
              <Text variant="secondary">
                {v.routeName ?? REGION_NAMES[v.region]}
              </Text>
            </div>
          </header>

          <Button
            variant={following ? 'primary' : 'secondary'}
            icon={<CrosshairIcon weight={following ? 'fill' : 'regular'} />}
            onClick={onToggleFollow}
          >
            {following ? 'Following on the map' : 'Follow on the map'}
          </Button>

          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            {headsign && (
              <>
                <dt className="text-kumo-subtle">Heading to</dt>
                <dd>{headsign}</dd>
              </>
            )}
            <dt className="text-kumo-subtle">{v.status ? STATUS[v.status] : 'Next stop'}</dt>
            <dd>
              {stop ? (
                <button type="button" className="text-left text-kumo-link hover:underline" onClick={() => onOpenHref(stopHref(v.region, stop.id))}>
                  {stop.name}
                </button>
              ) : v.stopId ? (
                stops ? `Stop ${v.stopId}` : '…'
              ) : (
                'Not reported'
              )}
            </dd>
            <dt className="text-kumo-subtle">Last reported</dt>
            <dd>{v.timestamp ? <RelativeTime at={v.timestamp} now={now} /> : 'Not reported'}</dd>
          </dl>

          {v.tripId && (
            <button
              type="button"
              className="justify-self-start text-sm text-kumo-link hover:underline"
              onClick={() => onOpenHref(tripHref(v.region, v.tripId!, v.route))}
            >
              This trip's stops and times
            </button>
          )}

          <section className="grid gap-2">
            <Text as="h3" variant="heading">
              Alerts for this route
            </Text>
            {routeAlerts.length ? (
              <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
                {routeAlerts.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => onOpenAlert(a.id)} className="grid w-full gap-1 px-3 py-2.5 text-left hover:bg-kumo-tint">
                      <Text bold>{a.header}</Text>
                      <Badge variant="outline">{a.effect}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Text variant="secondary">{alerts ? 'No disruptions reported for this route.' : 'Loading…'}</Text>
            )}
          </section>

          {routeInfo(v.route, v.region)?.url && (
            <a
              href={routeInfo(v.route, v.region)!.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-kumo-link underline decoration-1 underline-offset-2"
            >
              Timetable on TransLink
              <NewTabNote />
            </a>
          )}

          <Text size="xs" variant="secondary">
            Shown at the GPS position TransLink last reported for this vehicle, checked every 15 seconds. Route, stop
            and destination names from TransLink's published timetable data.
          </Text>
        </div>
      </div>
    </div>
  )
}
