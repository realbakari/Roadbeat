import { json } from './_lib/http.js'
import { ingest, loadSnapshot, saveSnapshot } from './_lib/newsIngest.js'
import { storeConfigured } from './_lib/store.js'

// Reads the news monitor's feeds and stores the result. A scheduler calls this
// every 5 minutes with `Authorization: Bearer $CRON_SECRET`, the header Vercel
// Cron sends (see .github/workflows/news-ingest.yml, and docs/deploy.md for why
// GitHub does the scheduling on Vercel's Hobby plan).

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Unauthorised' }, 401)
  if (!storeConfigured) return json({ skipped: 'No Redis store is connected, so /api/news reads the feeds on demand.' }, 200, 0)
  const previous = await loadSnapshot()
  const snapshot = await ingest(previous)
  await saveSnapshot(snapshot)
  return json({ items: snapshot.items.length, sources: snapshot.sources }, 200, 0)
}
