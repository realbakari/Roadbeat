import type { NewsSnapshot } from '../src/api/newsTypes.js'
import { json, upstream } from './_lib/http.js'
import { ingest, loadSnapshot, saveSnapshot } from './_lib/newsIngest.js'
import { storeConfigured } from './_lib/store.js'

// GET /api/news: the Queensland news monitor's items from the last 48 hours —
// headline, link, publisher, time, the summary's first sentence and the places
// matched in them — with each feed's status. Items are grouped into stories in
// the browser (src/lib/newsStories.ts).

/** A stored snapshot older than this means the scheduler has stopped, so this request reads the feeds itself. */
const STALE_MS = 15 * 60_000
const MEMORY_TTL = 5 * 60_000

let memory: { at: number; snapshot: Promise<NewsSnapshot> } | null = null

/** Without a store, the feeds are read at most once per 5 minutes per warm function. */
function fromMemory(now: number): Promise<NewsSnapshot> {
  if (!memory || now - memory.at > MEMORY_TTL) {
    const previous = memory?.snapshot.catch(() => null)
    const snapshot = (previous ?? Promise.resolve(null)).then((p) => ingest(p, now))
    memory = { at: now, snapshot }
    snapshot.catch(() => (memory = null))
  }
  return memory.snapshot
}

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
