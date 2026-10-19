import webpush from 'web-push'
import type { TransitRegion } from '../src/api/transitTypes.js'
import { commuteAlerts, commuteWindow } from '../src/lib/commute.js'
import { departuresAt } from '../src/lib/departures.js'
import { bushfires, roadEvents, routeInfo, stops, transitRealtime, trips } from './_lib/feeds.js'
import { json, noStore } from './_lib/http.js'
import { PushRecord, seenState } from './_lib/pushRecord.js'
import { allSubscriptions, deleteSubscription, deleteSubscriptions, saveSubscription, saveSubscriptions, storeConfigured } from './_lib/store.js'
import { SITE } from './_lib/tools.js'

// Sends commute push alerts. A scheduler calls this every few minutes with
// `Authorization: Bearer $CRON_SECRET` (see .github/workflows/push-check.yml).
// Only commutes inside their window are checked, and each alert is sent once.
// Each run first deletes subscriptions unused for 60 days (KEEP_UNSEEN_MS).

const MAX_PER_RUN = 3
const KEEP_SENT = 100

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Unauthorised' }, 401)
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!storeConfigured || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return noStore({ skipped: 'Push alerts are not set up on this server.' })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const now = Date.now()
  const parsed = (await allSubscriptions()).flatMap(([id, raw]) => {
    const r = PushRecord.safeParse(raw)
    return r.success ? [[id, r.data] as const] : []
  })
  const expired: string[] = []
  const stamped: [string, PushRecord][] = []
  const records: [string, PushRecord][] = []
  for (const [id, r] of parsed) {
    const state = seenState(r, now)
    if (state === 'expired') expired.push(id)
    else if (state === 'unstamped') stamped.push([id, { ...r, seen: now }])
    else records.push([id, r])
  }
  records.push(...stamped)
  await deleteSubscriptions(expired)
  await saveSubscriptions(stamped)
  const active = records.filter(([, r]) => commuteWindow(r.commute, now)?.active)
  if (!active.length) return noStore({ subscriptions: records.length, active: 0, sent: 0, expired: expired.length })

  // Fetch each official feed once for every active commute.
  const regions = [...new Set(active.flatMap(([, r]) => (r.commute.stopId ? [r.commute.region] : [])))] as TransitRegion[]
  const [{ events }, { fires }, ...realtime] = await Promise.all([roadEvents(), bushfires(), ...regions.map((r) => transitRealtime(r))])
  const rtByRegion = new Map(regions.map((r, i) => [r, realtime[i]]))

  let sent = 0
  let removed = 0
  for (const [id, record] of active) {
    const c = record.commute
    const stop = stops.get(c.region, c.stopId)
    const rt = rtByRegion.get(c.region)
    const departures =
      stop && rt ? departuresAt({ ...rt, trips, now }, c.region, new Set([stop.id, ...stops.children(stop).map((s) => s.id)]), 200) : []
    const fresh = commuteAlerts(c, { events, departures, fires, stopName: stop?.name ?? null, stopAt: stop?.position ?? null }, routeInfo, now).filter(
      (a) => !record.sent.includes(a.key),
    )
    if (!fresh.length) continue

    let gone = false
    const delivered: string[] = []
    for (const a of fresh.slice(0, MAX_PER_RUN)) {
      try {
        await webpush.sendNotification(record.subscription, JSON.stringify({ title: a.title, body: a.body, url: `/#${a.href}`, tag: a.key }), { TTL: 30 * 60 })
        delivered.push(a.key)
        sent++
      } catch (e) {
        // 404 and 410 mean the browser has dropped the subscription.
        if (e instanceof webpush.WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
          gone = true
          break
        }
      }
    }
    if (gone) {
      await deleteSubscription(id)
      removed++
      continue
    }
    // Alerts beyond the per-run limit are marked sent too, so a burst doesn't trickle out over later runs.
    // A failed send isn't, so it's tried again on the next run. An alert the push
    // service took shows the subscription is still in use.
    const done = [...delivered, ...fresh.slice(MAX_PER_RUN).map((a) => a.key)]
    if (done.length) await saveSubscription(id, { ...record, sent: [...record.sent, ...done].slice(-KEEP_SENT), seen: delivered.length ? now : record.seen })
  }
  return noStore({ subscriptions: records.length, active: active.length, sent, removed, expired: expired.length })
}
