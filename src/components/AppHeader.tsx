import { Button, Text, Tooltip } from '@cloudflare/kumo'
import {
  ArrowClockwiseIcon,
  CarProfileIcon,
  MoonIcon,
  ProhibitIcon,
  SirenIcon,
  SunIcon,
  TrafficConeIcon,
  VideoCameraIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useMemo } from 'react'
import type { TrafficEvent } from '../api/types'
import type { useNotifications } from '../hooks/useNotifications'
import { DEFAULT_FILTERS, isClosure, isUpcoming, type EventFilters } from '../lib/filters'
import { timeAgo } from '../lib/format'
import { InstallApp } from './InstallApp'
import { NotificationCenter } from './NotificationCenter'
import type { Panel } from './SidePanel'

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
  error: string | null
  fetchedAt: number | null
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
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
  error,
  fetchedAt,
  loading,
  refreshing,
  onRefresh,
}: Props) {
  const stats = useMemo(() => {
    const current = events.filter((e) => !isUpcoming(e, now))
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
      label: 'Current events',
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-kumo-line bg-kumo-base px-4">
      <a href="#" onClick={(e) => (e.preventDefault(), onHome())} className="flex min-w-0 items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="size-7" />
        <div className="grid leading-tight">
          <Text variant="heading" as="h1">
            Roadbeat
          </Text>
          <span className="hidden text-xs text-kumo-subtle sm:block">Live roads and transport across Queensland</span>
        </div>
      </a>

      <nav aria-label="Quick filters" className="hidden min-w-0 items-center gap-1.5 md:flex">
        {chips.map(({ key, ...chip }) => (
          <StatChip key={key} {...chip} />
        ))}
      </nav>

      <div className="flex items-center gap-1">
        <InstallApp />
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
        <span className="mr-1 hidden items-center gap-1.5 text-sm text-kumo-subtle sm:flex" aria-live="polite">
          <span className={`size-2 rounded-full ${error ? 'bg-kumo-danger' : 'bg-kumo-success'}`} aria-hidden />
          {fetchedAt ? `Updated ${timeAgo(fetchedAt, now)}` : 'Connecting…'}
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
      className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-left ring ${
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
