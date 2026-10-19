import { Button, DropdownMenu, Text, Tooltip } from '@cloudflare/kumo'
import {
  ArrowClockwiseIcon,
  ArrowsInSimpleIcon,
  CoffeeIcon,
  ArrowsOutSimpleIcon,
  ChatCircleTextIcon,
  CarProfileIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  InfoIcon,
  PulseIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  MoonIcon,
  ProhibitIcon,
  SirenIcon,
  SunIcon,
  TrafficConeIcon,
  VideoCameraIcon,
  WarningIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useMemo } from 'react'
import { SUPPORT_URL } from '../lib/support'
import { NewTabNote } from './NewTabNote'
import type { TrafficEvent } from '../api/types'
import type { useNotifications } from '../hooks/useNotifications'
import { DEFAULT_FILTERS, isClosure, isCurrent, type EventFilters } from '../lib/filters'
import { feedAnnouncement, feedStatus } from '../lib/feedAge'
import { timeDetail } from '../lib/relativeTime'
import { useInstallMenu } from '../hooks/useInstallMenu'
import { NotificationCenter } from './NotificationCenter'
import { VisitorCount } from './VisitorCount'
import type { Visitors } from '../api/visits'
import type { Panel } from './SidePanel'
import { GlobalSearch, type LoadedSources } from './GlobalSearch'

interface Props {
  mode: 'light' | 'dark'
  onToggleMode: () => void
  now: number
  events: TrafficEvent[]
  cameraCount: number
  /** True until the first load finishes, so counts show "…" rather than 0. */
  firstLoad: boolean
  panel: Panel
  transitOpen: boolean
  filters: EventFilters
  /** Opens the event list with the filter change applied. */
  onShowEvents: (next: (f: EventFilters) => EventFilters) => void
  onShowCameras: () => void
  onHome: () => void
  notifications: ReturnType<typeof useNotifications>
  onOpenHref: (href: string) => void
  onAlertSettings: () => void
  /** Opens the feedback form. */
  onFeedback: () => void
  /** Everything loaded so far, for the search. */
  searchSources: LoadedSources
  /** Opens a search result's hash. */
  onOpenSearch: (href: string) => void
  error: string | null
  fetchedAt: number | null
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  /** Whether the side panel fills the window (tablet width and up). */
  panelExpanded: boolean
  onTogglePanelExpanded: () => void
  /** How many people are using the app, or null where the server doesn't count. */
  visitors: Visitors | null
}

/** The top bar: logo, quick-filter counts, notifications, data freshness, refresh and colour mode. */
export function AppHeader({
  mode,
  onToggleMode,
  now,
  events,
  cameraCount,
  firstLoad,
  panel,
  transitOpen,
  filters,
  onShowEvents,
  onShowCameras,
  onHome,
  notifications,
  onOpenHref,
  onAlertSettings,
  onFeedback,
  searchSources,
  onOpenSearch,
  error,
  fetchedAt,
  loading,
  refreshing,
  onRefresh,
  panelExpanded,
  onTogglePanelExpanded,
  visitors,
}: Props) {
  const install = useInstallMenu()
  const stats = useMemo(() => {
    const current = events.filter((e) => isCurrent(e, now))
    return {
      current: current.length,
      closures: current.filter(isClosure).length,
      crashes: current.filter((e) => e.properties.event_type === 'Crash').length,
      redAlerts: current.filter((e) => e.properties.event_priority === 'Red Alert').length,
    }
  }, [events, now])

  const chips: (StatChipProps & { key: string })[] = [
    {
      key: 'all',
      label: 'Happening now',
      value: firstLoad ? null : stats.current,
      icon: TrafficConeIcon,
      active: panel === 'events' && !transitOpen && filters.when === 'now' && !filtersActive(filters),
      apply: () => onShowEvents(() => ({ ...DEFAULT_FILTERS, sort: filters.sort })),
    },
    {
      key: 'closures',
      label: 'Closures',
      value: firstLoad ? null : stats.closures,
      icon: ProhibitIcon,
      tone: 'danger',
      active: panel === 'events' && filters.closuresOnly,
      apply: () => onShowEvents((f) => ({ ...f, when: 'now', closuresOnly: !f.closuresOnly })),
    },
    {
      key: 'crashes',
      label: 'Crashes',
      value: firstLoad ? null : stats.crashes,
      icon: CarProfileIcon,
      tone: 'danger',
      active: panel === 'events' && filters.types.size === 1 && filters.types.has('Crash'),
      apply: () =>
        onShowEvents((f) => ({
          ...f,
          when: 'now',
          types: f.types.size === 1 && f.types.has('Crash') ? new Set() : new Set(['Crash' as const]),
        })),
    },
    {
      key: 'red',
      label: 'Red alerts',
      value: firstLoad ? null : stats.redAlerts,
      icon: SirenIcon,
      tone: 'danger',
      active: panel === 'events' && filters.priority === 'Red Alert',
      apply: () => onShowEvents((f) => ({ ...f, when: 'now', priority: f.priority === 'Red Alert' ? 'all' : 'Red Alert' })),
    },
    {
      key: 'cameras',
      label: 'Cameras',
      value: firstLoad ? null : cameraCount,
      icon: VideoCameraIcon,
      active: panel === 'cameras' && !transitOpen,
      apply: onShowCameras,
    },
  ]

  return (
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-3 border-b border-kumo-line bg-kumo-base px-4 pt-[env(safe-area-inset-top)]">
      <a href="#" onClick={(e) => (e.preventDefault(), onHome())} className="flex min-w-0 shrink-0 items-center gap-2.5 sm:shrink">
        <img src="/favicon.svg" alt="" className="size-7" />
        <div className="grid min-w-0 leading-tight">
          <Text variant="heading" as="h1">
            Roadbeat
          </Text>
          {/* The tagline gives way to the quick-filter counts where both don't fit. */}
          <span className="hidden truncate text-xs text-kumo-subtle sm:block lg:hidden 2xl:block">
            Live roads and transport across Queensland
          </span>
        </div>
      </a>

      <nav aria-label="Quick filters" className="hidden min-w-0 items-center gap-1.5 lg:flex">
        {chips.map(({ key, ...chip }) => (
          <StatChip key={key} {...chip} />
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        <GlobalSearch sources={searchSources} onOpen={onOpenSearch} />
        {/* From 2xl only: below that the quick-filter chips need the room, so the More menu lists it instead. */}
        <VisitorCount visitors={visitors} className="mr-2 hidden 2xl:flex" />
        <NotificationCenter
          items={notifications.items}
          unread={notifications.unread}
          now={now}
          onOpen={(n) => {
            notifications.markRead(n.id)
            if (n.href) onOpenHref(n.href)
          }}
          onMarkAllRead={notifications.markAllRead}
          onClear={notifications.clear}
          onSettings={onAlertSettings}
        />
        <span
          className="mx-1 flex items-center gap-1.5 text-sm whitespace-nowrap text-kumo-subtle"
          title={fetchedAt ? `Road events updated ${timeDetail(fetchedAt, now)?.spoken ?? 'at an unknown time'}` : 'Connecting…'}
        >
          {/* A feed error swaps the dot for a warning shape, so it never rests on colour alone. */}
          {error ? (
            <WarningIcon size={16} weight="fill" className="shrink-0 text-kumo-danger" aria-hidden />
          ) : (
            <span className="size-2 shrink-0 rounded-full bg-kumo-success" aria-hidden />
          )}
          {/* Screen readers can read the status at every width; sighted users see it from lg up. */}
          <span className="sr-only lg:not-sr-only">{feedStatus(error, fetchedAt, now)}</span>
        </span>
        {/* Announced only when the feed goes down or comes back, not as the minutes tick by. */}
        <span role="status" className="sr-only">
          {feedAnnouncement(error, fetchedAt)}
        </span>
        <Tooltip
          content="Refresh now"
          render={
            <Button
              variant="ghost"
              shape="square"
              aria-label="Refresh events"
              icon={<ArrowClockwiseIcon />}
              loading={refreshing && !loading}
              onClick={onRefresh}
            />
          }
        />
        {/* On phones the colour toggle lives in the More menu, so the name keeps its room. */}
        <span className="hidden sm:contents">
          <Tooltip
            content={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            render={
              <Button
                variant="ghost"
                shape="square"
                aria-label="Toggle colour mode"
                icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />}
                onClick={onToggleMode}
              />
            }
          />
        </span>
        <DropdownMenu>
          <DropdownMenu.Trigger render={<Button variant="ghost" shape="square" aria-label="More" icon={<DotsThreeIcon weight="bold" />} />} />
          <DropdownMenu.Content align="end">
            {/* A plain element, not DropdownMenu.Label: Base UI's Label must sit in a Group and throws otherwise, which blanked the whole app once a count existed. */}
            {visitors && (
              <div className="2xl:hidden">
                <VisitorCount visitors={visitors} className="flex px-2 py-1.5" />
                <DropdownMenu.Separator />
              </div>
            )}
            <DropdownMenu.Item icon={panelExpanded ? ArrowsInSimpleIcon : ArrowsOutSimpleIcon} onClick={onTogglePanelExpanded} className="hidden md:flex">
              {panelExpanded ? 'Back to the map' : 'Expand the panel'}
            </DropdownMenu.Item>
            <DropdownMenu.Item icon={mode === 'dark' ? SunIcon : MoonIcon} onClick={onToggleMode} className="sm:hidden">
              {mode === 'dark' ? 'Light mode' : 'Dark mode'}
            </DropdownMenu.Item>
            <DropdownMenu.LinkItem href="/dashboard" icon={SquaresFourIcon}>
              Network dashboard
            </DropdownMenu.LinkItem>
            <DropdownMenu.LinkItem href="/status" icon={PulseIcon}>
              Feed status
            </DropdownMenu.LinkItem>
            <DropdownMenu.Separator />
            <DropdownMenu.LinkItem href="/about/" icon={InfoIcon}>
              About
            </DropdownMenu.LinkItem>
            <DropdownMenu.LinkItem href="/privacy/" icon={ShieldCheckIcon}>
              Privacy
            </DropdownMenu.LinkItem>
            {install.item}
            <DropdownMenu.Item icon={ChatCircleTextIcon} onClick={onFeedback}>
              Send feedback
            </DropdownMenu.Item>
            <DropdownMenu.LinkItem href="/contact/" icon={EnvelopeSimpleIcon}>
              Contact
            </DropdownMenu.LinkItem>
            <DropdownMenu.Separator />
            <DropdownMenu.LinkItem href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" icon={CoffeeIcon}>
              Buy me a coffee
              <NewTabNote />
            </DropdownMenu.LinkItem>
          </DropdownMenu.Content>
        </DropdownMenu>
        {install.steps}
      </div>
    </header>
  )
}

interface StatChipProps {
  label: string
  /** Null while the first load is in progress, so "0" never stands in for "not loaded yet". */
  value: number | null
  icon: Icon
  tone?: 'danger'
  active: boolean
  apply: () => void
}

/**
 * A header count that is also a shortcut: it shows the live number and, when
 * clicked, opens the list filtered to it (click again to clear).
 */
function StatChip({ label, value, icon: I, tone, active, apply }: StatChipProps) {
  const alert = tone === 'danger' && value != null && value > 0
  return (
    <button
      type="button"
      onClick={apply}
      aria-pressed={active}
      title={active ? `Showing ${label.toLowerCase()} — click to clear` : `Show ${label.toLowerCase()}`}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md py-1 pr-3 pl-1 text-left ring ${
        active ? 'bg-kumo-tint ring-kumo-brand' : 'ring-kumo-line hover:bg-kumo-tint'
      }`}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-full ${alert ? 'bg-kumo-danger/10 text-kumo-danger' : 'bg-kumo-recessed text-kumo-subtle'}`}
        aria-hidden
      >
        <I size={14} weight="bold" />
      </span>
      <span className={`text-sm font-semibold tabular-nums ${alert ? 'text-kumo-danger' : value == null ? 'text-kumo-subtle' : 'text-kumo-strong'}`}>
        {value ?? '…'}
      </span>
      <span className="hidden text-sm text-kumo-subtle xl:inline">{label}</span>
      <span className="sr-only xl:hidden">{label}</span>
    </button>
  )
}

/** Whether any list filter besides sorting is set. */
function filtersActive(f: EventFilters) {
  return !!f.query || f.types.size > 0 || f.district !== 'all' || f.priority !== 'all' || f.closuresOnly
}
