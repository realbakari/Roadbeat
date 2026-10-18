import { z } from 'zod'
import { json, noStore, preflightFor } from './_lib/http.js'
import { PushRecord, Subscription, Commute } from './_lib/pushRecord.js'
import { countSubscriptions, deleteSubscription, saveSubscription, storeConfigured, subscriptionId } from './_lib/store.js'

// Subscribe and unsubscribe for commute push alerts. api/push-check.ts sends them.

const MAX_SUBSCRIPTIONS = 5000
const enabled = storeConfigured && !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY

/** Runs the store's part of a request, so a Redis outage is a 502 the app can show rather than a crash. */
async function withStore(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (e) {
    console.error('Push store failed:', e)
    return json({ error: "Push alerts couldn't be saved right now. Try again shortly." }, 502)
  }
}

/** GET /api/push: whether push alerts are set up on this server. */
export function GET() {
  return json({ enabled }, 200, 300)
}

/** POST /api/push: { subscription, commute } — save or update this browser's commute. */
export async function POST(request: Request) {
  if (!enabled) return json({ error: "Push alerts aren't set up on this server yet." }, 503)
  const parsed = z.object({ subscription: Subscription, commute: Commute }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid subscription or commute.', issues: z.flattenError(parsed.error).fieldErrors }, 400)
  const id = subscriptionId(parsed.data.subscription.endpoint)
  const record: PushRecord = { ...parsed.data, sent: [] }
  return withStore(async () => {
    if ((await countSubscriptions()) >= MAX_SUBSCRIPTIONS) return json({ error: 'Push alerts are full right now. Try again later.' }, 503)
    await saveSubscription(id, record)
    return noStore({ ok: true })
  })
}

/** DELETE /api/push: { endpoint } — forget this browser. */
export async function DELETE(request: Request) {
  if (!storeConfigured) return noStore({ ok: true })
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Send { endpoint }.' }, 400)
  const id = subscriptionId(parsed.data.endpoint)
  return withStore(async () => {
    await deleteSubscription(id)
    return noStore({ ok: true })
  })
}

export const OPTIONS = preflightFor('GET, POST, DELETE, OPTIONS')
