import { z } from 'zod'

// What a browser sends to subscribe, and what is stored for it: the push
// subscription, the commute to watch, the alert keys already sent, and when the
// subscription was last known to be in use.

export const Commute = z.object({
  roads: z.array(z.string().trim().min(1).max(80)).max(10),
  region: z.enum(['SEQ', 'CNS']),
  stopId: z.string().max(40).nullable(),
  route: z.string().max(60).nullable(),
  minutes: z.number().int().min(0).max(24 * 60 - 1),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
})

/**
 * The push services browsers subscribe through: Google's (Chrome, Edge,
 * Samsung Internet, Opera), Mozilla's, Apple's and Microsoft's. The server
 * sends each alert to the subscription's endpoint, so any other address is
 * refused: it would make the server send requests wherever a caller chose.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/]

export function isPushEndpoint(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => h.test(u.hostname))
  } catch {
    return false
  }
}

/**
 * A subscription key as browsers give it: base64url that decodes to `bytes`
 * bytes (65 for the P-256 public key, 16 for the auth secret). A record with a
 * key web-push can't encrypt to would fail on every send and never be removed.
 */
const pushKey = (bytes: number) =>
  z
    .string()
    .max(200)
    .refine((s) => /^[\w-]+={0,2}$/.test(s) && Buffer.from(s, 'base64url').length === bytes, `Push keys must be ${bytes} bytes of base64url`)

export const Subscription = z.object({
  endpoint: z.url().max(1000).refine(isPushEndpoint, 'Push endpoints must be a browser push service, over HTTPS'),
  keys: z.object({ p256dh: pushKey(65), auth: pushKey(16) }),
})

export const PushRecord = z.object({
  subscription: Subscription,
  commute: Commute,
  /** Alert keys already sent, newest last, so each alert goes out once. */
  sent: z.array(z.string()).default([]),
  /**
   * When the app last sent this subscription or an alert last reached it, in ms.
   * Records saved before this field was added have none.
   */
  seen: z.number().int().positive().optional(),
})
export type PushRecord = z.infer<typeof PushRecord>

/** A subscription that neither the app nor an alert has used for this long is deleted, so made-up ones can't pile up. */
export const KEEP_UNSEEN_MS = 60 * 86_400_000

/**
 * What api/push-check.ts does with a stored record: delete it once it's been
 * unseen for KEEP_UNSEEN_MS, stamp it with the current check if it was saved
 * before records had a last-seen time (so its 60 days start at the first check
 * after this change, not at once), or keep it as it is.
 */
export function seenState(record: PushRecord, now: number): 'current' | 'expired' | 'unstamped' {
  if (record.seen === undefined) return 'unstamped'
  return now - record.seen > KEEP_UNSEEN_MS ? 'expired' : 'current'
}

/**
 * The record to save when a browser sends its subscription and commute. The app
 * re-sends an unchanged commute to show it's still in use, and that keeps the
 * alerts already sent, so none goes out twice. A changed commute starts afresh.
 */
export function receivedRecord(previous: PushRecord | null, incoming: Pick<PushRecord, 'subscription' | 'commute'>, now: number): PushRecord {
  const same = previous !== null && JSON.stringify(previous.commute) === JSON.stringify(incoming.commute)
  return { ...incoming, sent: same ? previous.sent : [], seen: now }
}
