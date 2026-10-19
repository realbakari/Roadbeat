import { Loader, Select, Text } from '@cloudflare/kumo'
import { BoatIcon, BusIcon, CaretRightIcon, TrainIcon, TramIcon, type Icon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { routeInfo } from '../api/translink'
import { isTransitRegion, TRANSIT_REGIONS, type TransitRegion } from '../api/transitTypes'
import { useTimetableIndex } from '../hooks/useTransitFeeds'
import { regionalRoutes, type RegionRoute } from '../lib/regionalRoutes'
import { routeHref } from '../lib/route'
import { readableTextOn } from '../lib/routeColor'
import { REGION_NAMES } from '../lib/transitRegions'

const MODE_ICON: Record<string, Icon> = { train: TrainIcon, bus: BusIcon, ferry: BoatIcon, tram: TramIcon }

/** Routes as rows that open their route page, each with its number badge and official name. */
export function RouteRows({ routes, showRegion, onNavigate }: { routes: RegionRoute[]; showRegion?: boolean; onNavigate: (hash: string) => void }) {
  return (
    <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
      {routes.map((r) => (
        <li key={r.region + r.code}>
          <button
            type="button"
            onClick={() => onNavigate(routeHref(r.region, r.code))}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
          >
            <RouteBadge r={r} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {r.long || `Route ${r.short}`}
              {showRegion && <span className="text-kumo-subtle"> · {REGION_NAMES[r.region]}</span>}
            </span>
            <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" />
          </button>
        </li>
      ))}
    </ul>
  )
}

const REGIONS = TRANSIT_REGIONS.filter((r) => r !== 'SEQ')

/** The Lines tab's routes outside SEQ, one region at a time, from Translink's published timetables. */
export function RegionalRoutesDirectory({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const { index, failed } = useTimetableIndex(true)
  const [region, setRegion] = useState<TransitRegion>('CNS')
  const all = useMemo(() => (index ? regionalRoutes(index, routeInfo) : null), [index])
  const routes = all?.filter((r) => r.region === region) ?? null
  const items = useMemo(
    () => Object.fromEntries([...REGIONS].sort((a, b) => REGION_NAMES[a].localeCompare(REGION_NAMES[b])).map((r) => [r, REGION_NAMES[r]])),
    [],
  )
  return (
    <section className="mx-4 grid gap-2">
      <Text as="h3" variant="heading">
        Regional routes
      </Text>
      <Text size="sm" variant="secondary">
        Translink's bus and ferry routes outside South East Queensland, with their published timetables.
      </Text>
      <Select
        aria-label="Region"
        size="sm"
        className="w-64"
        value={region}
        onValueChange={(v) => typeof v === 'string' && isTransitRegion(v) && setRegion(v)}
        items={items}
      />
      {failed ? (
        <Text variant="secondary">Translink's published timetable isn't available here right now.</Text>
      ) : !routes ? (
        <Loader size="sm" />
      ) : (
        <RouteRows routes={routes} onNavigate={onNavigate} />
      )}
    </section>
  )
}

/** The route number in its official colour, with its mode's icon so a number alone reads as a bus, ferry or train. */
function RouteBadge({ r }: { r: RegionRoute }) {
  const I = MODE_ICON[routeInfo(r.code, r.region)?.mode ?? 'bus']
  return (
    <span
      className={`flex h-6 min-w-10 shrink-0 items-center justify-center gap-1 rounded px-1.5 text-xs font-semibold ${r.color ? '' : 'bg-kumo-contrast text-kumo-inverse'}`}
      style={r.color ? { backgroundColor: r.color, color: readableTextOn(r.color) } : undefined}
    >
      <I size={12} weight="fill" aria-hidden />
      {r.short}
    </span>
  )
}
