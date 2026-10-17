import { z } from 'zod'

// What a browser sends to subscribe, and what is stored for it: the push
// subscription, the commute to watch, and the alert keys already sent.

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

export const Subscription = z.object({
  endpoint: z.url().max(1000).refine(isPushEndpoint, 'Push endpoints must be a browser push service, over HTTPS'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

export const PushRecord = z.object({
  subscription: Subscription,
  commute: Commute,
  /** Alert keys already sent, newest last, so each alert goes out once. */
  sent: z.array(z.string()).default([]),
})
export type PushRecord = z.infer<typeof PushRecord>
