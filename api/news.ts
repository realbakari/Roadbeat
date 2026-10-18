import type { NewsSnapshot } from '../src/api/newsTypes.js'
import { json, upstream } from './_lib/http.js'
import { ingest, loadSnapshot, saveSnapshot } from './_lib/newsIngest.js'
import { memoised } from './_lib/memo.js'
import { STALE_MS, storeConfigured } from './_lib/store.js'

// GET /api/news: the Queensland news monitor's items from the last 48 hours —
// headline, link, publisher, time, the summary's first sentence and the places
// matched in them — with each feed's status. Items are grouped into stories in
// the browser (src/lib/newsStories.ts).

const MEMORY_TTL = 5 * 60_000

/** Without a store, the feeds are read at most once per 5 minutes per warm function. */
const fromMemory = memoised<NewsSnapshot>(MEMORY_TTL, (previous, now) => (previous?.catch(() => null) ?? Promise.resolve(null)).then((p) => ingest(p, now)))

export function GET() {
  return upstream(async () => {
    const now = Date.now()
    if (!storeConfigured) return json(await fromMemory(now), 200, 60)
    let snapshot = await loadSnapshot()
    if (!snapshot || now - snapshot.fetchedAt > STALE_MS) {
      snapshot = await ingest(snapshot, now)
      await saveSnapshot(snapshot)
    }
    return json(snapshot, 200, 60)
  })
}
