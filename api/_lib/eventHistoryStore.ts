import { EventHistory, type HistoryResponse } from '../../src/api/historyTypes.js'
import { EMPTY_HISTORY, recordRun } from '../../src/lib/eventHistory.js'
import { roadEvents } from './feeds.js'
import { redis, storeConfigured } from './store.js'

// The road event history: which QLDTraffic events were in effect at each read
// of the feed over the last 48 hours. The news monitor's 5-minute run records
// a read (api/news-ingest.ts) into Redis under one key; api/history.ts serves
// it, and records a read itself when the stored record has gone stale. Without
// a store, each warm function keeps its own record from the time it started.

const KEY = 'events:history'
/** A run is recorded at most this often, so a burst of requests adds one read, not many. */
const RUN_INTERVAL_MS = 5 * 60_000
/** A stored record older than this means the scheduler has stopped, so a request records a run itself. */
export const STALE_MS = 15 * 60_000

/** The stored history, or null if there is none (or it no longer parses). */
export async function loadHistory(): Promise<EventHistory | null> {
  if (!storeConfigured) return null
  const raw = await redis<string | null>(['GET', KEY])
  if (!raw) return null
  try {
    const parsed = EventHistory.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function saveHistory(history: EventHistory) {
  if (storeConfigured) await redis(['SET', KEY, JSON.stringify(history)])
}

/** Reads the events feed now and adds the run to `previous`. */
export async function recordRead(previous: EventHistory | null, now = Date.now()): Promise<EventHistory> {
  const { events, published } = await roadEvents()
  return recordRun(previous ?? EMPTY_HISTORY, events, now, published)
}

/** The scheduled run: reads the feed and stores the run. Nothing happens without a store. */
export async function ingestHistory(now = Date.now()): Promise<EventHistory | null> {
  if (!storeConfigured) return null
  const history = await recordRead(await loadHistory(), now)
  await saveHistory(history)
  return history
}

let memory: { since: number; history: EventHistory } = { since: Date.now(), history: EMPTY_HISTORY }

/**
 * The history to serve: the store's, with a run added when it has gone stale;
 * or, without a store, this function's own record, with a run added when the
 * last one is 5 minutes old.
 */
export async function currentHistory(now = Date.now()): Promise<HistoryResponse> {
  if (storeConfigured) {
    let history = await loadHistory()
    if (!history || now - (history.runs.at(-1)?.at ?? 0) > STALE_MS) {
      history = await recordRead(history, now)
      await saveHistory(history)
    }
    return { ...history, kept: 'store', note: null }
  }
  if (now - (memory.history.runs.at(-1)?.at ?? 0) >= RUN_INTERVAL_MS) {
    memory = { since: memory.since, history: await recordRead(memory.history, now) }
  }
  return {
    ...memory.history,
    kept: 'memory',
    note: `No store is connected, so this record holds only what this server has read since ${new Date(memory.since).toISOString()}.`,
  }
}
