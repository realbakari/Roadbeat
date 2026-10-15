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

export const Subscription = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'Push endpoints must use HTTPS'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

export const PushRecord = z.object({
  subscription: Subscription,
  commute: Commute,
  /** Alert keys already sent, newest last, so each alert goes out once. */
  sent: z.array(z.string()).default([]),
})
export type PushRecord = z.infer<typeof PushRecord>
