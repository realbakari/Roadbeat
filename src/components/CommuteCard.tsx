import { Button, Switch, Text } from '@cloudflare/kumo'
import { BriefcaseIcon, CheckCircleIcon, FireIcon, PencilSimpleIcon, ProhibitIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import type { FireWarning } from '../api/bushfires'
import { disablePush, enablePush, pushAvailable, pushSupported, renewPush, updatePush } from '../api/push'
import { alertActive, routeInfo, type TransitAlert } from '../api/translink'
import type { LiveVehicle } from '../api/transitTypes'
import type { TrafficEvent } from '../api/types'
import { useStopIndex, useTripIndex, useTripUpdates } from '../hooks/useTransitFeeds'
import { commuteWindow, firesNear, onRoute, roadsBriefing, type Commute } from '../lib/commute'
import { saveCommute, useCommute } from '../lib/commuteStore'
import { departuresAt } from '../lib/departures'
import { isClosure } from '../lib/filters'
import { stopAndChildren } from '../lib/planner'
import { CommuteDialog } from './CommuteDialog'
import { DelayChip } from './Realtime'
import { brisbaneClock as clock, brisbaneWeekday as weekday } from '../lib/aest'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function daysText(days: number[]) {
  const set = [...days].sort().join()
  if (set === '1,2,3,4,5') return 'Weekdays'
  if (set === '0,1,2,3,4,5,6') return 'Every day'
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(', ')
}

const routeNames = (code: string, region: Commute['region']) => routeInfo(code, region)

interface Props {
  events: TrafficEvent[]
  /** When QLDTraffic's events were last read successfully, or null if never. */
  eventsAt: number | null
  eventsError: string | null
  fires: FireWarning[] | null
  vehicles: LiveVehicle[]
  alerts: TransitAlert[] | null
  now: number
  onOpen: (hash: string) => void
}

/**
 * "My commute" briefing at the top of the road events list: the rider's roads,
 * their service from their stop, and bushfire warnings nearby, all from the
 * official feeds. Shows a prompt to set one up when there is none.
 */
export function CommuteCard({ events, eventsAt, eventsError, fires, vehicles, alerts, now, onOpen }: Props) {
  const commute = useCommute()
  const [editing, setEditing] = useState(false)
  const save = (c: Commute | null) => {
    if (!c && commute?.push) void disablePush()
    if (c && commute?.push) void updatePush(c)
    saveCommute(c ? { ...c, push: commute?.push } : null)
  }

  return (
    <>
      {commute ? (
        <Briefing commute={commute} events={events} eventsAt={eventsAt} eventsError={eventsError} fires={fires} vehicles={vehicles} alerts={alerts} now={now} onOpen={onOpen} onEdit={() => setEditing(true)} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="flex w-full items-start gap-3 border-b border-kumo-line px-4 py-3 text-left hover:bg-kumo-tint">
          <span className="flex h-lh items-center text-kumo-subtle">
            <BriefcaseIcon size={18} />
          </span>
          <span className="grid gap-0.5">
            <span className="text-sm font-medium text-kumo-strong">Set up My commute</span>
            <span className="text-sm text-kumo-subtle">One card before you leave: your roads, your train or bus, and nearby bushfire warnings.</span>
          </span>
        </button>
      )}
      <CommuteDialog open={editing} onOpenChange={setEditing} commute={commute} onSave={save} />
    </>
  )
}

function Briefing({
  commute: c,
  events,
  eventsAt,
  eventsError,
  fires,
  vehicles,
  alerts,
  now,
  onOpen,
  onEdit,
}: Props & { commute: Commute & { push?: boolean }; onEdit: () => void }) {
  const win = commuteWindow(c, now)
  const live = !!win?.active && !!c.stopId
  const stops = useStopIndex(!!c.stopId, !!c.stopId && /^\d+$/.test(c.stopId))
  const trips = useTripIndex(live)
  const { updates } = useTripUpdates(live)
  const stop = stops?.get(c.region, c.stopId) ?? null

  const roads = useMemo(() => roadsBriefing(c, events, eventsAt, eventsError, now), [c, events, eventsAt, eventsError, now])
  const departures = useMemo(() => {
    if (!live || !updates || !stops || !stop) return null
    return departuresAt({ updates, vehicles, trips, now }, c.region, stopAndChildren(stops, stop), 200)
      .filter((d) => onRoute(c, d, routeNames))
      .slice(0, 3)
  }, [live, updates, stops, stop, vehicles, trips, now, c])
  const routeAlerts = useMemo(() => {
    if (!c.route || !alerts) return []
    return alerts.filter((a) => a.region === c.region && alertActive(a, now) && a.routes.some((code) => {
      const info = routeInfo(code, c.region)
      return [code, info?.short, info?.line].some((x) => x?.toLowerCase() === c.route!.toLowerCase())
    }))
  }, [alerts, c, now])
  const nearbyFires = useMemo(() => firesNear(stop?.position ?? null, fires ?? []), [stop, fires])

  const minutesAway = win ? Math.round((win.departs - now) / 60_000) : null
  const when = !win
    ? 'No days chosen'
    : win.active
      ? minutesAway! > 0
        ? `Leaving in ${minutesAway} min, at ${clock.format(win.departs)}`
        : `Usual departure ${clock.format(win.departs)}`
      : `Next: ${weekday.format(win.departs)} ${clock.format(win.departs)}`

  return (
    <section className={`grid gap-3 border-b border-kumo-line px-4 py-3 ${win?.active ? 'bg-kumo-tint/50' : ''}`} aria-label="My commute">
      <header className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-kumo-strong">
            <BriefcaseIcon size={16} /> My commute
          </h2>
          <Text size="sm" variant="secondary">
            {daysText(c.days)} · {when}
          </Text>
        </div>
        <Button size="xs" variant="ghost" icon={<PencilSimpleIcon />} onClick={onEdit}>
          Edit
        </Button>
      </header>

      {c.roads.length > 0 && (
        <div className="grid gap-1">
          <Text size="xs" variant="secondary" bold>
            Your roads: {c.roads.join(', ')}
          </Text>
          {roads.state === 'loading' ? (
            <Text size="sm" variant="secondary">
              Checking QLDTraffic…
            </Text>
          ) : roads.state === 'failed' ? (
            <span className="flex items-center gap-2 text-sm text-kumo-subtle">
              <WarningIcon size={14} className="text-kumo-warning" /> Couldn't load road events from QLDTraffic, so nothing can be said about your roads
            </span>
          ) : roads.events.length ? (
            <ul className="grid gap-1">
              {roads.events.slice(0, 3).map((e) => (
                <li key={e.properties.id}>
                  <button type="button" onClick={() => onOpen(`event/${e.properties.id}`)} className="flex w-full items-start gap-2 text-left text-sm hover:underline">
                    <span className="flex h-lh items-center">
                      {isClosure(e) ? <ProhibitIcon size={14} weight="bold" className="text-kumo-danger" /> : <WarningIcon size={14} className="text-kumo-warning" />}
                    </span>
                    <span>
                      <span className="font-medium">{isClosure(e) ? 'Closed' : e.properties.event_type}</span> · {[e.properties.road_summary?.road_name, e.properties.road_summary?.locality].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              ))}
              {roads.events.length > 3 && <li className="text-sm text-kumo-subtle">and {roads.events.length - 3} more</li>}
            </ul>
          ) : (
            <span className="flex items-center gap-2 text-sm text-kumo-subtle">
              <CheckCircleIcon size={14} className="text-kumo-success" /> Nothing reported by QLDTraffic right now
            </span>
          )}
        </div>
      )}

      {c.stopId && (
        <div className="grid gap-1">
          <Text size="xs" variant="secondary" bold>
            {c.route ?? 'Services'} from {stop?.name ?? 'your stop'}
          </Text>
          {!win?.active ? (
            <Text size="sm" variant="secondary">
              Live times show here from 90 minutes before you leave.
            </Text>
          ) : !departures ? (
            <Text size="sm" variant="secondary">
              Loading Translink real-time…
            </Text>
          ) : departures.length ? (
            <ul className="grid gap-1">
              {departures.map((d) => {
                const info = routeInfo(d.trip.route, d.trip.region)
                const cancelled = d.trip.relationship === 'cancelled'
                const platform = stops?.get(d.trip.region, d.stopId)?.platform
                return (
                  <li key={d.key} className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium tabular-nums">{clock.format(d.scheduled ?? d.time)}</span>
                    {cancelled ? <span className="font-medium text-kumo-danger">Cancelled</span> : d.vehicle && <DelayChip delay={d.delay} />}
                    <span className="min-w-0 truncate text-kumo-subtle">
                      {info?.line?.split(' ')[0] ?? info?.short ?? d.trip.route}
                      {d.headsign && ` to ${d.headsign}`}
                      {platform && ` · Platform ${platform}`}
                      {!d.vehicle && !cancelled && ' · scheduled'}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Text size="sm" variant="secondary">
              No matching services in Translink's real-time feed yet. It lists services running now or starting soon.
            </Text>
          )}
          {routeAlerts.length > 0 && (
            <button type="button" onClick={() => onOpen(`transit/alert/${encodeURIComponent(routeAlerts[0].id)}`)} className="flex items-start gap-2 text-left text-sm text-kumo-warning hover:underline">
              <span className="flex h-lh items-center">
                <WarningIcon size={14} />
              </span>
              {routeAlerts.length === 1 ? routeAlerts[0].header : `${routeAlerts.length} Translink service alerts on ${c.route}`}
            </button>
          )}
        </div>
      )}

      {nearbyFires.length > 0 && (
        <div className="grid gap-1">
          <Text size="xs" variant="secondary" bold>
            Bushfire warnings near {stop?.name ?? 'your stop'}
          </Text>
          {nearbyFires.slice(0, 2).map((f) => (
            <button key={f.id} type="button" onClick={() => onOpen(`fire/${encodeURIComponent(f.id)}`)} className="flex items-start gap-2 text-left text-sm hover:underline">
              <span className="flex h-lh items-center">
                <FireIcon size={14} className="text-kumo-danger" />
              </span>
              <span>
                <span className="font-medium">{f.level}</span> · {f.title}
              </span>
            </button>
          ))}
        </div>
      )}

      <PushToggle commute={c} />
    </section>
  )
}

/** Turns push alerts for the commute on or off, when this browser and the server support them. */
function PushToggle({ commute }: { commute: Commute & { push?: boolean } }) {
  const [available, setAvailable] = useState<boolean | null>(pushSupported() ? null : false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!pushSupported()) return
    let live = true
    pushAvailable().then((ok) => live && setAvailable(ok))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (available && commute.push) void renewPush(commute)
  }, [available, commute])
  if (!available) return null

  const toggle = async (on: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (on) await enablePush(commute)
      else await disablePush()
      saveCommute({ ...commute, push: on })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push alerts could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-1 border-t border-kumo-line pt-2">
      <Switch
        label="Push alerts, even when Roadbeat is closed"
        checked={!!commute.push}
        disabled={busy}
        onCheckedChange={(on: boolean) => void toggle(on)}
      />
      <Text size="xs" variant="secondary">
        Closures and crashes on your roads, your service cancelled or 5+ min late, and nearby Emergency or Watch and Act bushfires, during your commute
        window.
      </Text>
      {error && (
        <Text size="xs" DANGEROUS_className="text-kumo-danger">
          {error}
        </Text>
      )}
    </div>
  )
}
