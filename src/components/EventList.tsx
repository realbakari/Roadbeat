import { Button, Empty, InputGroup, Loader, Select, Tabs, Text } from '@cloudflare/kumo'
import { CheckCircleIcon, FunnelSimpleIcon, MagnifyingGlassIcon, NavigationArrowIcon, ProhibitIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type UIEvent } from 'react'
import type { FireWarning } from '../api/bushfires'
import type { EventType, TrafficEvent } from '../api/types'
import { FireList } from './FireList'
import { EVENT_TYPES, PRIORITIES } from '../lib/eventMeta'
import { matchesBase, type EventFilters, type SortKey, type When } from '../lib/filters'
import { nextHidden } from '../lib/scrollReveal'
import { distanceKm, eventAnchor, type LngLat } from '../lib/geo'
import { EventCard } from './EventCard'

interface Props {
  allEvents: TrafficEvent[]
  events: TrafficEvent[]
  districts: string[]
  filters: EventFilters
  onFiltersChange: (f: EventFilters) => void
  loading: boolean
  now: number
  userLocation: LngLat | null
  locating: boolean
  onLocate: () => void
  onSelect: (id: number) => void
  /** Queensland Fire Department warnings and fires, shown above current events. */
  fires: FireWarning[] | null
  onOpenHref: (hash: string) => void
}

export function EventList({
  allEvents,
  events,
  districts,
  filters,
  onFiltersChange,
  loading,
  now,
  userLocation,
  locating,
  onLocate,
  onSelect,
  fires,
  onOpenHref,
}: Props) {
  // On phones the district and priority pickers fold behind a button, so the list starts higher.
  const [moreOpen, setMoreOpen] = useState(false)
  // Also on phones, the controls slide away while scrolling down the list and return on scroll up.
  const [scrolledAway, setScrolledAway] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const lastScrollY = useRef(0)
  const ignoreScrollUntil = useRef(0)
  const hideControls = scrolledAway && !moreOpen && !searchFocused

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

  const moreActive = (filters.district !== 'all' ? 1 : 0) + (filters.priority !== 'all' ? 1 : 0)

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
                className="shrink-0 md:hidden"
                icon={<FunnelSimpleIcon />}
                aria-expanded={moreOpen}
                aria-controls="event-more-filters"
                onClick={() => setMoreOpen((o) => !o)}
              >
                Filters{moreActive > 0 && <span className="tabular-nums text-kumo-subtle">{moreActive}</span>}
              </Button>
            </div>

            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-px [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Event types">
              {EVENT_TYPES.map((m) => {
                const count = typeCounts.get(m.type) ?? 0
                const active = filters.types.has(m.type)
                return (
                  <button
                    key={m.type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleType(m.type)}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm whitespace-nowrap ring ${
                      active
                        ? 'bg-kumo-tint text-kumo-strong ring-kumo-brand'
                        : 'text-kumo-default ring-kumo-line hover:bg-kumo-tint'
                    }`}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                    {m.label}
                    <span className="text-kumo-subtle tabular-nums">{count}</span>
                  </button>
                )
              })}
              {/* Closures as a chip too, matching the header's Closures shortcut. */}
              <button
                type="button"
                aria-pressed={filters.closuresOnly}
                onClick={() => set('closuresOnly', !filters.closuresOnly)}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm whitespace-nowrap ring ${
                  filters.closuresOnly ? 'bg-kumo-tint text-kumo-strong ring-kumo-brand' : 'text-kumo-default ring-kumo-line hover:bg-kumo-tint'
                }`}
              >
                <ProhibitIcon size={14} weight="bold" className="text-kumo-danger" aria-hidden />
                Closures only
              </button>
            </div>

            <div id="event-more-filters" className={`${moreOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:grid`}>
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
            size="xs"
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
        {filters.when === 'now' && fires && <FireList fires={fires} now={now} onOpen={onOpenHref} />}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : events.length === 0 ? (
          <div className="px-4 py-12">
            <Empty
              size="sm"
              icon={<CheckCircleIcon size={32} className="text-kumo-inactive" />}
              title={filtered ? 'No matching events' : filters.when === 'upcoming' ? 'Nothing scheduled' : 'No events reported'}
              description={
                filtered ? 'Try a different search or clear the filters.' : 'Roads are clear across Queensland right now.'
              }
              contents={
                filtered ? (
                  <Button size="sm" onClick={reset}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
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
