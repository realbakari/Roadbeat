import { useKumoToastManager } from '@cloudflare/kumo'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FIRE_LEVELS, type FireLevel, type FireWarning } from '../api/bushfires'
import { alertActive, alertNextStart, type TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import {
  describeChange,
  eventHeadline,
  eventSignature,
  fireMatches,
  loadSettings,
  matchesRules,
  saveSettings,
  watchedRoutesIn,
  type AlertSettings,
} from '../lib/alertRules'
import { eventTitle } from '../lib/eventText'

export interface AppNotification {
  id: string
  kind: 'event-new' | 'event-update' | 'event-cleared' | 'transit' | 'fire'
  title: string
  body: string
  at: number
  /** Hash route to open, e.g. "event/123". */
  href: string | null
  tone: 'error' | 'warning' | 'info' | 'success'
  read: boolean
  /** Raised while the app was closed; shown in the centre but not toasted. */
  away?: boolean
}

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
}

/**
 * Watches road events and TransLink alerts for things the user cares about and
 * raises notifications: a toast while the app is in view, a system notification
 * (if allowed) while it's in the background, and an entry in the notification
 * centre either way. Runs only while the app is open in a tab.
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
  onOpen,
}: {
  settings: AlertSettings
  setSettings: ReturnType<typeof useAlertSettings>[1]
  events: TrafficEvent[]
  eventsAt: number | null
  transitAlerts: TransitAlert[] | null
  fires: FireWarning[] | null
  onOpen: (href: string) => void
}) {
  const toasts = useKumoToastManager()
  const [items, setItems] = useState<AppNotification[]>(() => load(LIST_KEY, []))
  const seen = useRef<Seen | null>(load<Seen | null>(SEEN_KEY, null))
  const first = useRef({ events: true, transit: true, fires: true })
  const latest = useRef({ settings, onOpen })
  useLayoutEffect(() => {
    latest.current = { settings, onOpen }
  }, [settings, onOpen])

  useEffect(() => store(LIST_KEY, items.slice(0, MAX)), [items])

  const raise = useCallback(
    (list: Omit<AppNotification, 'read'>[]) => {
      if (!list.length) return
      const { settings: s, onOpen: open } = latest.current
      setItems((prev) => [...list.map((n) => ({ ...n, read: false })), ...prev].slice(0, MAX))
      const live = list.filter((n) => !n.away)
      if (!s.inApp || !live.length) return

      const hidden = document.visibilityState !== 'visible'
      const canSystem = s.browser && 'Notification' in window && Notification.permission === 'granted'
      for (const n of live.slice(0, 3)) {
        if (hidden && canSystem) {
          const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' })
          sys.onclick = () => {
            window.focus()
            if (n.href) open(n.href)
            sys.close()
          }
        } else if (!hidden) {
          toasts.add({
            title: n.title,
            description: n.body.length > 140 ? `${n.body.slice(0, 137)}…` : n.body,
            variant: n.tone,
            timeout: 8000,
            actions: n.href ? [{ children: 'View', size: 'xs', onClick: () => open(n.href!) }] : undefined,
          })
        }
      }
      if (live.length > 3 && !hidden) {
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
    const sigs: Record<string, string> = {}
    for (const e of events) sigs[e.properties.id] = eventSignature(e)

    const prev = seen.current?.events
    const away = first.current.events
    first.current.events = false
    if (prev) {
      const out: Omit<AppNotification, 'read'>[] = []
      const watched = new Set(s.watchedEvents)
      for (const e of events) {
        const id = String(e.properties.id)
        if (!(id in prev)) {
          if (watched.has(e.properties.id) || matchesRules(e, s, now)) {
            const h = eventHeadline(e)
            const severe = e.properties.event_type === 'Crash' || e.properties.event_priority === 'Red Alert'
            out.push({ id: `new-${id}-${now}`, kind: 'event-new', ...h, at: now, href: `event/${id}`, tone: severe ? 'error' : 'warning', away })
          }
        } else if (watched.has(e.properties.id) && prev[id] !== sigs[id]) {
          out.push({
            id: `upd-${id}-${now}`,
            kind: 'event-update',
            title: `${describeChange(prev[id], e)} · ${eventTitle(e)}`,
            body: eventHeadline(e).body,
            at: now,
            href: `event/${id}`,
            tone: e.properties.status === 'Reopened' ? 'success' : 'info',
            away,
          })
        }
      }
      for (const id of s.watchedEvents) {
        if (String(id) in prev && !(String(id) in sigs)) {
          out.push({
            id: `clr-${id}-${now}`,
            kind: 'event-cleared',
            title: 'Event cleared',
            body: `A road event you were watching (#${id}) is no longer listed by QLDTraffic.`,
            at: now,
            href: null,
            tone: 'success',
            away,
          })
        }
      }
      // Away alerts are capped so a long absence doesn't flood the centre.
      raise(away ? out.slice(0, 20) : out)
      const stillListed = s.watchedEvents.filter((id) => String(id) in sigs)
      if (stillListed.length !== s.watchedEvents.length) setSettings((x) => ({ ...x, watchedEvents: stillListed }))
    }
    seen.current = { events: sigs, transit: seen.current?.transit ?? [], fires: seen.current?.fires }
    store(SEEN_KEY, seen.current)
  }, [events, eventsAt, raise, setSettings])

  // TransLink alerts on watched routes and lines.
  useEffect(() => {
    if (!transitAlerts) return
    const s = latest.current.settings
    const ids = transitAlerts.map((a) => a.id)
    const prev = seen.current?.transit
    const away = first.current.transit
    first.current.transit = false
    if (prev && s.routes.length) {
      const known = new Set(prev)
      const now = Date.now()
      raise(
        transitAlerts
          .filter((a) => !known.has(a.id))
          .flatMap((a) => {
            const hit = watchedRoutesIn(a, s.routes)
            if (!hit.length) return []
            const next = alertActive(a, now) ? null : alertNextStart(a, now)
            return [
              {
                id: `tl-${a.id}`,
                kind: 'transit' as const,
                title: `${hit.join(', ')}: ${a.header}`,
                body: next ? `Starts ${new Date(next).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. ${a.effect}.` : `${a.effect}. ${a.description}`,
                at: now,
                href: `transit/alert/${encodeURIComponent(a.id)}`,
                tone: 'warning' as const,
                away,
              },
            ]
          }),
      )
    }
    seen.current = { events: seen.current?.events ?? {}, transit: ids, fires: seen.current?.fires }
    store(SEEN_KEY, seen.current)
  }, [transitAlerts, raise])

  // Queensland Fire Department warnings: new ones, and warnings whose level goes up.
  useEffect(() => {
    if (!fires) return
    const s = latest.current.settings
    const levels: Record<string, string> = {}
    for (const f of fires) levels[f.id] = f.level
    const prev = seen.current?.fires
    const away = first.current.fires
    first.current.fires = false
    if (prev) {
      const now = Date.now()
      const out: Omit<AppNotification, 'read'>[] = []
      for (const f of fires) {
        if (!fireMatches(f, s)) continue
        const was = prev[f.id]
        const rose = was != null && FIRE_LEVELS.indexOf(f.level) < FIRE_LEVELS.indexOf(was as FireLevel)
        if (was != null && !rose) continue
        out.push({
          id: `fire-${f.id}-${f.level}`,
          kind: 'fire',
          title: `${rose ? 'Now ' : ''}${f.levelText}: ${f.area ?? f.title}`,
          body: [f.callToAction, f.header].filter(Boolean).join(' — ') || f.title,
          at: now,
          href: `fire/${encodeURIComponent(f.id)}`,
          tone: f.level === 'Advice' ? 'warning' : 'error',
          away,
        })
      }
      raise(away ? out.slice(0, 10) : out)
    }
    seen.current = { events: seen.current?.events ?? {}, transit: seen.current?.transit ?? [], fires: levels }
    store(SEEN_KEY, seen.current)
  }, [fires, raise])

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

export async function requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}
