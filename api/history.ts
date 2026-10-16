import { currentHistory } from './_lib/eventHistoryStore.js'
import { json, upstream } from './_lib/http.js'

// GET /api/history: which QLDTraffic road events were in effect at each read
// of the feed over the last 48 hours (src/api/historyTypes.ts), for the app's
// timeline. Every entry is a read of the official feed at the time shown;
// nothing between reads is filled in.

export function GET() {
  return upstream(async () => json(await currentHistory(), 200, 60))
}
