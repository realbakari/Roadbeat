import { ingestHistory } from './_lib/eventHistoryStore.js'
import { json, noStore } from './_lib/http.js'
import { ingest, loadSnapshot, saveSnapshot } from './_lib/newsIngest.js'
import { storeConfigured } from './_lib/store.js'

// Reads the news monitor's feeds and stores the result, and records which road
// events are in effect in the event history (api/_lib/eventHistoryStore.ts). A
// scheduler calls this every 5 minutes with `Authorization: Bearer $CRON_SECRET`,
// the header Vercel Cron sends (see .github/workflows/news-ingest.yml, and
// docs/deploy.md for why GitHub does the scheduling on Vercel's Hobby plan).

async function ingestNews() {
  const snapshot = await ingest(await loadSnapshot())
  await saveSnapshot(snapshot)
  return snapshot
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Unauthorised' }, 401)
  if (!storeConfigured) return noStore({ skipped: 'No Redis store is connected, so /api/news reads the feeds on demand.' })
  // The two records are independent: a feed that fails leaves the other's run stored.
  const [news, history] = await Promise.allSettled([ingestNews(), ingestHistory()])
  if (news.status === 'rejected') throw news.reason
  const events =
    history.status === 'fulfilled'
      ? { runs: history.value?.runs.length ?? 0, inEffect: history.value?.runs.at(-1)?.count ?? 0 }
      : { error: history.reason instanceof Error ? history.reason.message : String(history.reason) }
  return noStore({ items: news.value.items.length, sources: news.value.sources, events })
}
