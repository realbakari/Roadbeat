import { Badge, Button, Loader, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, BoatIcon, BusIcon, MapTrifoldIcon, TrainIcon, TramIcon, type Icon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { alertActive, regionRouteInfo, type TransitAlert } from '../api/translink'
import type { LiveVehicle, TransitRegion } from '../api/transitTypes'
import { useNow } from '../hooks/useNow'
import { useTransitAlerts } from '../hooks/useTransitFeeds'
import { useRealtimeState } from '../hooks/useRegionFeeds'
import { readableTextOn } from '../lib/routeColor'
import { alertsForCodes, vehiclesForCodes } from '../lib/transitLines'
import { MAIN_REGIONS, REGION_NAMES } from '../lib/transitRegions'
import { LineDepartures, TimetableOnly } from './Departures'
import { LineTimetable, TimetableLink } from './Timetable'
import { AlertCards } from './TransitParts'
import { Section } from './ui/Section'
import { ExternalLink } from './ui/Links'

const MODE_ICON: Record<string, Icon> = { train: TrainIcon, bus: BusIcon, ferry: BoatIcon, tram: TramIcon }

/**
 * One route's page outside SEQ, where Translink's network status lists no
 * lines: its alerts, next departures where the region's real-time feed
 * carries any, and its published timetable.
 */
export function RoutePage({
  region,
  code,
  alerts: mainAlerts,
  alertsError,
  vehicles,
  onNavigate,
  onShowOnMap,
}: {
  region: TransitRegion
  code: string
  /** Translink service alerts for SEQ and Cairns, or null while loading. */
  alerts: TransitAlert[] | null
  /** Why the main alerts feed failed, so a failure never spins for ever. */
  alertsError?: string | null
  vehicles: LiveVehicle[]
  onNavigate: (hash: string) => void
  onShowOnMap: (title: string, match: (code: string) => boolean) => void
}) {
  const info = regionRouteInfo(code, region)
  const realtime = useRealtimeState(region)
  const main = MAIN_REGIONS.includes(region)
  const own = useTransitAlerts(!main, region)
  const alerts = main ? mainAlerts : own.alerts
  const now = useNow(60_000)
  const match = useMemo(() => (c: string) => c === code, [code])
  const routeAlerts = alerts ? alertsForCodes(alerts, match).filter((a) => a.region === region && alertActive(a, now)) : null
  const live = vehiclesForCodes(vehicles, match).filter((v) => v.region === region)
  const title = `${info?.short ?? code} ${info?.long ?? ''}`.trim()
  const I = MODE_ICON[info?.mode ?? 'bus']

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={() => history.back()}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            <span
              className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-1.5 font-semibold ${info?.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
              style={info?.color ? { backgroundColor: info.color, color: readableTextOn(info.color) } : undefined}
            >
              <I size={18} weight="fill" aria-hidden />
              {info?.short && <span className="ml-1">{info.short}</span>}
            </span>
            <div className="grid min-w-0 gap-1">
              <Text as="h2" variant="heading" size="lg">
                {info?.long || `Route ${code}`}
              </Text>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{REGION_NAMES[region]}</Badge>
                {realtime === 'live' && <Badge variant="outline">Real-time</Badge>}
                {realtime === 'timetable' && <Badge variant="outline">Timetable only</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <TimetableLink target="route-timetable" />
                {realtime === 'live' && (
                  <Button size="sm" variant="secondary" icon={<MapTrifoldIcon />} disabled={!live.length} onClick={() => onShowOnMap(title, match)}>
                    Show on map
                  </Button>
                )}
              </div>
            </div>
          </header>

          <Section spaced title="Current status">
            {!routeAlerts ? (
              alertsError ? <Text variant="error">Couldn't load Translink's service alerts.</Text> : <Loader size="sm" />
            ) : routeAlerts.length ? (
              <AlertCards alerts={routeAlerts} onOpen={(a) => onNavigate(`transit/alert/${encodeURIComponent(a.id)}`)} />
            ) : (
              <Text variant="secondary">No current disruptions reported.</Text>
            )}
          </Section>

          <Section spaced title="Next departures">
            {realtime === 'live' ? (
              <LineDepartures region={region} match={match} mode={info?.mode ?? 'bus'} vehicles={vehicles} onNavigate={onNavigate} />
            ) : (
              <TimetableOnly region={region} state={realtime} />
            )}
          </Section>

          <Section spaced title="Timetable" id="route-timetable">
            <LineTimetable region={region} match={match} mode={info?.mode ?? 'bus'} vehicles={vehicles} onNavigate={onNavigate} />
          </Section>

          {realtime === 'live' && (
            <Section spaced title="Live">
              <Text>
                <span className="font-medium tabular-nums">{live.length}</span> {live.length === 1 ? 'service' : 'services'} on this route
                reporting a position right now
              </Text>
            </Section>
          )}

          {info?.url && <ExternalLink href={info.url}>Timetable on Translink</ExternalLink>}
        </div>
      </div>
    </div>
  )
}
