import { Banner, Button, InputGroup, Loader, Select, Tabs, Text } from '@cloudflare/kumo'
import { FlameIcon, FunnelSimpleIcon, MagnifyingGlassIcon, NavigationArrowIcon, ProhibitIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type ReactNode, type UIEvent } from 'react'
import type { FireWarning } from '../api/bushfires'
import type { FireBans } from '../api/fireBans'
import { FireBansCard } from './FireBansCard'
import type { EventType, TrafficEvent } from '../api/types'
import { FireList } from './FireList'
import { WarningList } from './WarningList'
import type { QldWarning } from '../api/qldWarnings'
import { CouncilWorksList } from './CouncilWorksList'
import type { RoadOccupancy } from '../api/bccRoadOccupancies'
import { EVENT_TYPES, PRIORITIES } from '../lib/eventMeta'
import { filtersKey, matchesBase, type EventFilters, type SortKey, type When } from '../lib/filters'
import { nextHidden } from '../lib/scrollReveal'
import { distanceKm, eventAnchor, type LngLat } from '../lib/geo'
import { EventCard } from './EventCard'
import { useAnnouncement } from '../hooks/useAnnouncement'
import { useLocalityIndex } from '../hooks/useLocality'
import { brisbaneDayClock } from '../lib/aest'
import { chipClass } from './chip'
import { LoadFailed, NoResults } from './ui/StateMessage'

interface Props {
  allEvents: TrafficEvent[]
  events: TrafficEvent[]
  districts: string[]
  filters: EventFilters
  onFiltersChange: (f: EventFilters) => void
  loading: boolean
  /** Why road events failed to load, while none has loaded yet; the list says so rather than "none reported". */
  loadError: string | null
  onRetry: () => unknown
  now: number
  userLocation: LngLat | null
  locating: boolean
  onLocate: () => void
  onSelect: (id: number) => void
  /** Queensland Fire Department warnings and fires, shown above current events. */
  fires: FireWarning[] | null
  /** The Queensland Fire Department's fire bans; a card shows only while one is listed. */
  fireBans: FireBans | null
  /** Why the bushfire list is missing or stale, or null while the feed is fine. */
  fireNotice?: string | null
  /** Queensland Disaster Management's storm, flood, cyclone and other hazard warnings, shown first. */
  warnings: QldWarning[] | null
  /** Why the warnings are missing or stale, or null while the feed is fine. */
  warningNotice?: string | null
  onOpenHref: (hash: string) => void
  /** Shown above the list, e.g. the My commute card. */
  top?: ReactNode
  /** Brisbane City Council planned road occupancies, or null while loading. */
  occupancies: RoadOccupancy[] | null
  /** Ids of the events the user watches, and the toggle for a card's Watch button. */
  watchedEvents: number[]
  onToggleWatch: (id: number) => void
  /** Events QLDTraffic didn't list on this browser's last visit, and when that visit was. */
  newIds: Set<number>
  newSince: number | null
}

export function EventList({
  allEvents,
  events,
  districts,
  filters,
  onFiltersChange,
  loading,
  loadError,
  onRetry,
  now,
  userLocation,
  locating,
  onLocate,
  onSelect,
  fires,
  fireBans,
  fireNotice,
  warnings,
  warningNotice,
  onOpenHref,
  top,
  occupancies,
  watchedEvents,
  onToggleWatch,
  newIds,
  newSince,
}: Props) {
  // On phones the district and priority pickers fold behind a button, so the list starts higher.
  const [moreOpen, setMoreOpen] = useState(false)
  // Also on phones, the controls slide away while scrolling down the list and return on scroll up.
  const [scrolledAway, setScrolledAway] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const lastScrollY = useRef(0)
  const ignoreScrollUntil = useRef(0)
  const hideControls = scrolledAway && !moreOpen && !searchFocused
  const localities = useLocalityIndex()

  const onListScroll = (e: UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop
    const lastY = lastScrollY.current
    lastScrollY.current = y
    // Collapsing the controls resizes the list, which can nudge scrollTop; ignore that while it animates.
    if (performance.now() < ignoreScrollUntil.current) return
    const next = window.matchMedia('(max-width: 767px)').matches && nextHidden(scrolledAway, y, lastY)
    if (next === scrolledAway) return
    ignoreScrollUntil.current = performance.now() + 300
    setScrolledAway(next)
  }
  const set = <K extends keyof EventFilters>(k: K, v: EventFilters[K]) => onFiltersChange({ ...filters, [k]: v })

  const typeCounts = useMemo(() => {
    const counts = new Map<EventType, number>()
    for (const e of allEvents) {
      if (!matchesBase(e, filters)) continue
      counts.set(e.properties.event_type, (counts.get(e.properties.event_type) ?? 0) + 1)
    }
    return counts
  }, [allEvents, filters])

  const whenCounts = useMemo(() => {
    const count = (when: When) => {
      const f = { ...filters, when }
      return allEvents.filter((e) => matchesBase(e, f) && (f.types.size === 0 || f.types.has(e.properties.event_type))).length
    }
    return { now: count('now'), upcoming: count('upcoming') }
  }, [allEvents, filters])

  // How many the Closures chip would show: the other filters as set, with closures only on.
  const closureCount = useMemo(() => {
    const f = { ...filters, closuresOnly: true }
    return allEvents.filter((e) => matchesBase(e, f) && (f.types.size === 0 || f.types.has(e.properties.event_type))).length
  }, [allEvents, filters])

  const toggleType = (t: EventType) => {
    const next = new Set(filters.types)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    set('types', next)
  }

  const filtered =
    filters.query !== '' ||
    filters.types.size > 0 ||
    filters.district !== 'all' ||
    filters.priority !== 'all' ||
    filters.closuresOnly

  const activeLabels = [
    ...EVENT_TYPES.filter((m) => filters.types.has(m.type)).map((m) => m.label),
    filters.closuresOnly && 'Closures',
    filters.district !== 'all' && filters.district,
    filters.priority !== 'all' && `${filters.priority} priority`,
    filters.query && `“${filters.query}”`,
  ].filter(Boolean)

  const reset = () =>
    onFiltersChange({ ...filters, query: '', types: new Set(), district: 'all', priority: 'all', closuresOnly: false })

  const shownNew = events.filter((e) => newIds.has(e.properties.id)).length
  const moreActive = (filters.district !== 'all' ? 1 : 0) + (filters.priority !== 'all' ? 1 : 0)
  const announcement = useAnnouncement(filtersKey(filters), events.length ? `${events.length} ${events.length === 1 ? 'event' : 'events'}` : 'No matching events')

  const sortItems: Record<SortKey, string> = { priority: 'Priority', recent: 'Recently updated', nearest: 'Nearest to me' }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${hideControls ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
        inert={hideControls}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-2.5 border-b border-kumo-line px-4 pt-2 pb-3 md:gap-3 md:pt-3 md:pb-4">
            <Tabs
              variant="underline"
              value={filters.when}
              onValueChange={(v) => set('when', v as When)}
              tabs={[
                { value: 'now', label: <span>Happening now <span className="text-kumo-subtle tabular-nums">{whenCounts.now}</span></span> },
                { value: 'upcoming', label: <span>Upcoming <span className="text-kumo-subtle tabular-nums">{whenCounts.upcoming}</span></span> },
              ]}
            />
            <div className="flex gap-2">
              <InputGroup className="min-w-0 flex-1">
                <InputGroup.Addon>
                  <MagnifyingGlassIcon />
                </InputGroup.Addon>
                <InputGroup.Input
                  aria-label="Search events"
                  placeholder="Search road, suburb or postcode"
                  value={filters.query}
                  onChange={(e) => set('query', e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {filters.query && (
                  <InputGroup.Button
                    variant="ghost"
                    shape="square"
                    aria-label="Clear search"
                    icon={<XIcon />}
                    onClick={() => set('query', '')}
                  />
                )}
              </InputGroup>
              <Button
                variant="secondary"
                className="shrink-0"
                icon={<FunnelSimpleIcon />}
                aria-expanded={moreOpen}
                aria-controls="event-more-filters"
                onClick={() => setMoreOpen((o) => !o)}
              >
                Filters{moreActive > 0 && <span className="tabular-nums text-kumo-subtle">{moreActive}</span>}
              </Button>
            </div>

            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-px [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Event types">
              {/* Closures first, as the header's Closures shortcut: the filter people most often look for. */}
              <button
                type="button"
                aria-pressed={filters.closuresOnly}
                onClick={() => set('closuresOnly', !filters.closuresOnly)}
                className={chipClass(filters.closuresOnly)}
              >
                <ProhibitIcon size={14} weight="bold" className="text-kumo-danger" aria-hidden />
                Closures only
                <span className="text-kumo-subtle tabular-nums">{closureCount}</span>
              </button>
              {EVENT_TYPES.map((m) => {
                const count = typeCounts.get(m.type) ?? 0
                const active = filters.types.has(m.type)
                return (
                  <button
                    key={m.type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleType(m.type)}
                    className={chipClass(active)}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                    {m.label}
                    <span className="text-kumo-subtle tabular-nums">{count}</span>
                  </button>
                )
              })}
            </div>

            <div id="event-more-filters" className={`${moreOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2`}>
              <Select
                aria-label="District"
                size="sm"
                className="w-full"
                value={filters.district}
                onValueChange={(v) => set('district', (v as string) ?? 'all')}
                items={{ all: 'All districts', ...Object.fromEntries(districts.map((d) => [d, d])) }}
              />
              <Select
                aria-label="Priority"
                size="sm"
                className="w-full"
                value={filters.priority}
                onValueChange={(v) => set('priority', (v as string) ?? 'all')}
                items={{ all: 'Any priority', ...Object.fromEntries(PRIORITIES.map((p) => [p, p])) }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-kumo-line bg-kumo-base px-4 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <Text variant="secondary" size="sm">
            <span className="whitespace-nowrap">
              <span className="tabular-nums">{events.length}</span> {events.length === 1 ? 'event' : 'events'}
            </span>
            {newSince != null && shownNew > 0 && (
              <span className="whitespace-nowrap" title={`Not listed by QLDTraffic at your last visit, ${brisbaneDayClock.format(newSince)}`}>
                {' · '}
                <span className="tabular-nums">{shownNew}</span> new since {brisbaneDayClock.format(newSince)}
              </span>
            )}
            <span role="status" className="sr-only">
              {announcement}
            </span>
          </Text>
          {hideControls && activeLabels.length > 0 && (
            <button
              type="button"
              className="min-w-0 truncate text-sm text-kumo-strong hover:underline"
              title="Show filters"
              onClick={() => setScrolledAway(false)}
            >
              {activeLabels.join(', ')}
            </button>
          )}
          {filtered && (
            <Button size="xs" variant="ghost" className="shrink-0" onClick={reset}>
              Clear filters
            </Button>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {filters.sort === 'nearest' && !userLocation && (
            <Button size="xs" variant="ghost" icon={<NavigationArrowIcon />} loading={locating} onClick={onLocate}>
              Use my location
            </Button>
          )}
          <Select
            aria-label="Sort events"
            size="sm"
            value={filters.sort}
            onValueChange={(v) => {
              const sort = (v as SortKey) ?? 'priority'
              if (sort === 'nearest' && !userLocation) onLocate()
              set('sort', sort)
            }}
            items={sortItems}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={onListScroll}>
        {filters.when === 'now' && top}
        {filters.when === 'now' && warningNotice && (
          <div className="border-b border-kumo-line px-4 py-3">
            <Banner variant="alert" size="sm" icon={<WarningIcon weight="fill" />} description={warningNotice} />
          </div>
        )}
        {filters.when === 'now' && warnings && <WarningList warnings={warnings} onOpen={onOpenHref} />}
        {filters.when === 'now' && fireNotice && (
          <div className="border-b border-kumo-line px-4 py-3">
            <Banner variant="alert" size="sm" icon={<FlameIcon weight="fill" />} description={fireNotice} />
          </div>
        )}
        {filters.when === 'now' && <FireBansCard bans={fireBans} />}
        {filters.when === 'now' && fires && <FireList fires={fires} now={now} onOpen={onOpenHref} />}
        {filters.when === 'now' && occupancies && <CouncilWorksList occupancies={occupancies} query={filters.query} now={now} />}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : loadError && allEvents.length === 0 ? (
          <LoadFailed what="road events" source="QLDTraffic" cause={loadError} onRetry={onRetry} retriesItself />
        ) : events.length === 0 && filtered ? (
          <NoResults what="road events" query={filters.query} onClear={reset} hint="Search by road, suburb, town or postcode, or clear the filters." />
        ) : events.length === 0 ? (
          <div className="px-4 py-4">
            <p className="m-0 font-semibold">{filters.when === 'upcoming' ? 'Nothing scheduled' : 'No road events reported'}</p>
            <Text variant="secondary">{filters.when === 'upcoming' ? 'QLDTraffic lists no planned roadworks or events ahead.' : 'QLDTraffic lists no road events in Queensland right now.'}</Text>
          </div>
        ) : (
          <ul className="divide-y divide-kumo-line">
            {events.map((e) => {
              const a = userLocation ? eventAnchor(e) : null
              return (
                <li key={e.properties.id}>
                  <EventCard
                    event={e}
                    now={now}
                    distanceKm={a && userLocation ? distanceKm(userLocation, a) : null}
                    upcoming={filters.when === 'upcoming'}
                    onSelect={onSelect}
                    watched={watchedEvents.includes(e.properties.id)}
                    onToggleWatch={onToggleWatch}
                    localities={localities}
                    onOpenPlace={onOpenHref}
                    isNew={newIds.has(e.properties.id)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
