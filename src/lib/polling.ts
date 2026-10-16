import type { AlertSettings } from './alertRules'

/**
 * Whether a feed's poll should run now. Feeds pause while the tab is hidden,
 * except those that raise alerts while system notifications are on: a hidden
 * tab is exactly when those notifications are shown.
 */
export function shouldPoll(visibility: DocumentVisibilityState, raisesAlerts: boolean, systemAlerts: boolean): boolean {
  return visibility === 'visible' || (raisesAlerts && systemAlerts)
}

/** Whether a feed paused in a hidden tab is due a read now the tab is back in view. */
export function dueOnReturn(lastRead: number, now: number, intervalMs: number): boolean {
  return now - lastRead >= intervalMs
}

/** Whether system notifications are on and the browser allows them. */
export function systemAlertsOn(s: Pick<AlertSettings, 'browser'>, permission: NotificationPermission | 'unsupported'): boolean {
  return s.browser && permission === 'granted'
}
