import { useKumoToastManager } from '@cloudflare/kumo'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FireWarning } from '../api/bushfires'
import type { QldWarning } from '../api/qldWarnings'
import type { TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { eventNotices, eventSignatures, fireLevels, fireNotices, newsNotices, transitNotices, warningLevels, warningNotices, type AppNotification, type Notice } from '../lib/alertNotices'
import { loadSettings, saveSettings, type AlertSettings } from '../lib/alertRules'
import { systemAlertsOn } from '../lib/polling'
import { setSystemAlerts } from './poll'
import type { NewsStory } from '../lib/newsStories'

const LIST_KEY = 'qldt-notifications'
const SEEN_KEY = 'qldt-seen'
const MAX = 60

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: notifications still work for this visit.
  }
}

interface Seen {
  events: Record<string, string> // id → signature
  transit: string[]
  /** Bushfire warning id → level. */
  fires?: Record<string, string>
  /** Queensland warning id → level. */
  warnings?: Record<string, string>
  /** News monitor story ids. */
  news?: string[]
}

/**
 * Watches road events and Translink alerts for things the user cares about and
 * raises notifications: a toast while the app is in view, a system notification
 * (if allowed) while it's in the background, and an entry in the notification
 * centre either way. Runs only while the app is open in a tab; with system
 * notifications on, the feeds that raise alerts keep polling in a hidden tab.
 */
export function useAlertSettings() {
  const [settings, setSettingsState] = useState<AlertSettings>(loadSettings)
  const setSettings = useCallback((next: AlertSettings | ((s: AlertSettings) => AlertSettings)) => {
    setSettingsState((prev) => {
      const s = typeof next === 'function' ? next(prev) : next
      saveSettings(s)
      return s
    })
  }, [])
  return [settings, setSettings] as const
}

export function useNotifications({
  settings,
  setSettings,
  events,
  eventsAt,
  transitAlerts,
  fires,
  warnings,
  stories,
  onOpen,
}: {
  settings: AlertSettings
  setSettings: ReturnType<typeof useAlertSettings>[1]
  events: TrafficEvent[]
  eventsAt: number | null
  transitAlerts: TransitAlert[] | null
  fires: FireWarning[] | null
  /** Queensland Disaster Management warnings, or null while they aren't loaded. */
  warnings: QldWarning[] | null
  /** News monitor stories, or null while they aren't loaded. */
  stories: NewsStory[] | null
  onOpen: (href: string) => void
}) {
  const toasts = useKumoToastManager()
  const [items, setItems] = useState<AppNotification[]>(() => load(LIST_KEY, []))
  const seen = useRef<Seen | null>(load<Seen | null>(SEEN_KEY, null))
  const first = useRef({ events: true, transit: true, fires: true, warnings: true, news: true })
  const latest = useRef({ settings, onOpen })
  useLayoutEffect(() => {
    latest.current = { settings, onOpen }
  }, [settings, onOpen])

  useEffect(() => store(LIST_KEY, items.slice(0, MAX)), [items])
  // Keeps the alert feeds polling in a hidden tab while system notifications can be shown.
  useEffect(() => setSystemAlerts('Notification' in window && systemAlertsOn(settings, Notification.permission)), [settings])

  const raise = useCallback(
    (list: Notice[]) => {
      if (!list.length) return
      const { settings: s, onOpen: open } = latest.current
      setItems((prev) => [...list.map((n) => ({ ...n, read: false })), ...prev].slice(0, MAX))
      const live = list.filter((n) => !n.away)
      if (!live.length) return

      const hidden = document.visibilityState !== 'visible'
      const canSystem = 'Notification' in window && systemAlertsOn(s, Notification.permission)
      // The two switches are separate: system notifications don't need in-app toasts on.
      for (const n of live.slice(0, 3)) {
        if (hidden && canSystem) {
          const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' })
          sys.onclick = () => {
            window.focus()
            if (n.href) open(n.href)
            sys.close()
          }
        } else if (!hidden && s.inApp) {
          toasts.add({
            title: n.title,
            description: n.body.length > 140 ? `${n.body.slice(0, 137)}…` : n.body,
            variant: n.tone,
            timeout: 8000,
            actions: n.href ? [{ children: 'View', size: 'xs', onClick: () => open(n.href!) }] : undefined,
          })
        }
      }
      if (live.length > 3 && !hidden && s.inApp) {
        toasts.add({ title: `${live.length - 3} more alerts`, description: 'Open the notification centre to see them all.', timeout: 6000 })
      }
    },
    [toasts],
  )

  // Road events: new matches, and changes to watched events.
  useEffect(() => {
    if (!eventsAt || !events.length) return
    const s = latest.current.settings
    const now = Date.now()
    const sigs = eventSignatures(events)

    const prev = seen.current?.events
    const away = first.current.events
    first.current.events = false
    if (prev) {
      raise(eventNotices(prev, events, s, now, away))
      const stillListed = s.watchedEvents.filter((id) => String(id) in sigs)
      if (stillListed.length !== s.watchedEvents.length) setSettings((x) => ({ ...x, watchedEvents: stillListed }))
    }
    seen.current = { ...seen.current, events: sigs, transit: seen.current?.transit ?? [] }
    store(SEEN_KEY, seen.current)
  }, [events, eventsAt, raise, setSettings])

  // Translink alerts on watched routes and lines.
  useEffect(() => {
    if (!transitAlerts) return
    const s = latest.current.settings
    const ids = transitAlerts.map((a) => a.id)
    const prev = seen.current?.transit
    const away = first.current.transit
    first.current.transit = false
    if (prev && s.routes.length) raise(transitNotices(prev, transitAlerts, s.routes, Date.now(), away))
    seen.current = { ...seen.current, events: seen.current?.events ?? {}, transit: ids }
    store(SEEN_KEY, seen.current)
  }, [transitAlerts, raise])

  // Queensland Fire Department warnings: new ones, and warnings whose level goes up.
  useEffect(() => {
    if (!fires) return
    const s = latest.current.settings
    const levels = fireLevels(fires)
    const prev = seen.current?.fires
    const away = first.current.fires
    first.current.fires = false
    if (prev) raise(fireNotices(prev, fires, s, Date.now(), away))
    seen.current = { ...seen.current, events: seen.current?.events ?? {}, transit: seen.current?.transit ?? [], fires: levels }
    store(SEEN_KEY, seen.current)
  }, [fires, raise])

  // Queensland Disaster Management warnings: new ones, and warnings whose level goes up.
  useEffect(() => {
    if (!warnings) return
    const s = latest.current.settings
    const prev = seen.current?.warnings
    const away = first.current.warnings
    first.current.warnings = false
    if (prev) raise(warningNotices(prev, warnings, s, Date.now(), away))
    seen.current = { events: seen.current?.events ?? {}, transit: seen.current?.transit ?? [], ...seen.current, warnings: warningLevels(warnings) }
    store(SEEN_KEY, seen.current)
  }, [warnings, raise])

  // News monitor stories: new ones only. A report joining a known story isn't news to the user.
  useEffect(() => {
    if (!stories) return
    const s = latest.current.settings
    const prev = seen.current?.news
    const away = first.current.news
    first.current.news = false
    if (prev) raise(newsNotices(prev, stories, s, Date.now(), away))
    seen.current = { events: seen.current?.events ?? {}, transit: seen.current?.transit ?? [], ...seen.current, news: stories.map((st) => st.id) }
    store(SEEN_KEY, seen.current)
  }, [stories, raise])

  const markAllRead = useCallback(() => setItems((l) => l.map((n) => ({ ...n, read: true }))), [])
  const markRead = useCallback((id: string) => setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n))), [])
  const clear = useCallback(() => setItems([]), [])

  const toggleWatchEvent = useCallback(
    (id: number) =>
      setSettings((s) => ({
        ...s,
        watchedEvents: s.watchedEvents.includes(id) ? s.watchedEvents.filter((x) => x !== id) : [...s.watchedEvents, id],
      })),
    [setSettings],
  )
  const toggleWatchRoute = useCallback(
    (route: string) =>
      setSettings((s) => {
        const has = s.routes.some((r) => r.toLowerCase() === route.toLowerCase())
        return { ...s, routes: has ? s.routes.filter((r) => r.toLowerCase() !== route.toLowerCase()) : [...s.routes, route] }
      }),
    [setSettings],
  )

  return {
    items,
    unread: items.filter((n) => !n.read).length,
    markAllRead,
    markRead,
    clear,
    toggleWatchEvent,
    toggleWatchRoute,
  }
}
