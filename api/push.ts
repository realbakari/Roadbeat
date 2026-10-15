import { z } from 'zod'
import { json } from './_lib/http.js'
import { PushRecord, Subscription, Commute } from './_lib/pushRecord.js'
import { countSubscriptions, deleteSubscription, saveSubscription, storeConfigured, subscriptionId } from './_lib/store.js'

// Subscribe and unsubscribe for commute push alerts. api/push-check.ts sends them.

const MAX_SUBSCRIPTIONS = 5000
const enabled = storeConfigured && !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY

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
  if ((await countSubscriptions()) >= MAX_SUBSCRIPTIONS) return json({ error: 'Push alerts are full right now. Try again later.' }, 503)
  const record: PushRecord = { ...parsed.data, sent: [] }
  await saveSubscription(id, record)
  return json({ ok: true }, 200, 0)
}

/** DELETE /api/push: { endpoint } — forget this browser. */
export async function DELETE(request: Request) {
  if (!storeConfigured) return json({ ok: true }, 200, 0)
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Send { endpoint }.' }, 400)
  await deleteSubscription(subscriptionId(parsed.data.endpoint))
  return json({ ok: true }, 200, 0)
}
