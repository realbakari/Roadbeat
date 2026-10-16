import { dueOnReturn, shouldPoll } from '../lib/polling'

let systemAlerts = false

/** Set from the alert settings: system notifications are on and allowed. */
export function setSystemAlerts(on: boolean) {
  systemAlerts = on
}

/**
 * Runs `load` every `ms` while the tab is visible, and while it is hidden too
 * when `raisesAlerts` and system notifications are on. A poll skipped while
 * hidden runs as soon as the tab is back in view. Call `load` once yourself
 * first; the returned function stops the polling.
 */
export function poll(load: () => unknown, ms: number, raisesAlerts = false): () => void {
  let last = Date.now()
  const run = () => {
    last = Date.now()
    load()
  }
  const id = setInterval(() => shouldPoll(document.visibilityState, raisesAlerts, systemAlerts) && run(), ms)
  const onShow = () => document.visibilityState === 'visible' && dueOnReturn(last, Date.now(), ms) && run()
  document.addEventListener('visibilitychange', onShow)
  return () => {
    clearInterval(id)
    document.removeEventListener('visibilitychange', onShow)
  }
}
