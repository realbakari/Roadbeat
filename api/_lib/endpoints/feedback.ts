import { FeedbackInput, feedbackRecord, KEEP, PER_DAY } from '../feedback.js'
import { json, noStore, preflight } from '../http.js'
import { redis, redisPipeline, storeConfigured, takeDaily } from '../store.js'
import { brisbaneDay, clientIp, rateKey } from '../visits.js'

// /api/feedback: bug reports and feature requests from the app's form.
//
// POST keeps a message in a capped Redis list. Each address may send PER_DAY a
// day, counted under a hash of the address (api/_lib/visits.ts), which isn't
// stored with the message. A message whose hidden field is filled is answered as if kept and
// thrown away, so a bot learns nothing.
// GET answers whether the form works here. With `Authorization: Bearer
// $CRON_SECRET` it returns the kept messages, newest first, for the owner.

const LIST = 'feedback'
const SALT = process.env.VISITS_SALT ?? process.env.CRON_SECRET ?? ''

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) {
    if (!storeConfigured) return noStore({ messages: [] })
    const raw = await redis<string[]>(['LRANGE', LIST, 0, KEEP - 1])
    return noStore({ messages: raw.map((r) => JSON.parse(r)) })
  }
  return json({ enabled: storeConfigured }, 200, 300)
}

export async function POST(request: Request) {
  if (!storeConfigured) return json({ error: "Feedback isn't set up on this server yet." }, 503)
  const parsed = FeedbackInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Check the message and try again.', issues: parsed.error.issues.map((i) => i.message) }, 400)
  const now = Date.now()
  const record = feedbackRecord(parsed.data, now)
  if (!record) return noStore({ ok: true })
  const day = brisbaneDay(now)
  const rate = rateKey('feedback', clientIp(request.headers), day, SALT)
  try {
    if (!(await takeDaily(rate, PER_DAY))) return json({ error: `That's ${PER_DAY} messages today from this address. Try again tomorrow.` }, 429)
    await redisPipeline([
      ['LPUSH', LIST, JSON.stringify(record)],
      ['LTRIM', LIST, 0, KEEP - 1],
    ])
  } catch (e) {
    console.error('Feedback store failed:', e)
    return json({ error: "Your message couldn't be saved. Try again shortly." }, 502)
  }
  return noStore({ ok: true })
}

export const OPTIONS = preflight
