import type { Commute } from '../lib/commute'

// Roadbeat's own push alert service (api/push.ts). The browser subscribes with
// the server's VAPID public key, then sends the subscription and the commute to
// watch. VITE_VAPID_PUBLIC_KEY is set at build time; without it push is off.

const KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** Whether this browser can receive push alerts at all, before asking the server. */
export function pushSupported() {
  return !!KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Whether the server has push alerts set up (its store and keys are configured). */
export async function pushAvailable(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const res = await fetch('/api/push')
    return res.ok && ((await res.json()) as { enabled?: boolean }).enabled === true
  } catch {
    return false
  }
}

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function subscription(create: boolean) {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing || !create) return existing
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) })
}

/** Asks for permission if needed, subscribes this browser and registers the commute. Throws with a message to show. */
export async function enablePush(commute: Commute) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings, then try again.')
  const sub = await subscription(true)
  if (!sub) throw new Error("This browser didn't create a push subscription.")
  const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), commute }) })
  if (!res.ok) throw new Error((((await res.json().catch(() => null)) as { error?: string } | null)?.error) ?? `Push service responded with ${res.status}.`)
}

/** Sends a changed commute for an existing subscription. */
export async function updatePush(commute: Commute) {
  const sub = await subscription(false)
  if (sub) await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), commute }) })
}

/** Removes this browser's subscription from the server and the browser. */
export async function disablePush() {
  const sub = await subscription(false)
  if (!sub) return
  await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
  await sub.unsubscribe()
}
