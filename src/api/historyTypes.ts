import { z } from 'zod'

// The road event history's stored and served shapes. The server writes it
// (api/_lib/eventHistoryStore.ts, on the news monitor's 5-minute run) and the
// browser validates it on the way in (src/api/history.ts), so both sides share
// one definition. QLDTraffic publishes only the present, so this is the only
// record of which events were in effect at an earlier time.

const LngLat = z.tuple([z.number(), z.number()])

/** One read of the events feed: when it was read, the feed's own publication stamp, and how many events were in effect. */
export const HistoryRun = z.object({
  /** When the feed was read, epoch ms. */
  at: z.number(),
  /** The feed's own `published` stamp at that read, epoch ms, or null when it gave none. */
  published: z.number().nullable(),
  /** Events in effect at that read. */
  count: z.number(),
})
export type HistoryRun = z.infer<typeof HistoryRun>

/**
 * One version of an event, as QLDTraffic published it: a new version is kept
 * each time `last_updated` changes, so a replay shows the type and priority the
 * event had then, not what it became later.
 */
export const HistoryEvent = z.object({
  id: z.number(),
  /** The event's `published` time, epoch ms, or null. */
  published: z.number().nullable(),
  /** The event's `last_updated` time, epoch ms, or null. */
  updated: z.number().nullable(),
  type: z.enum(['Hazard', 'Crash', 'Congestion', 'Roadworks', 'Special event', 'Flooding']),
  priority: z.enum(['Red Alert', 'High', 'Medium', 'Low']),
  closure: z.boolean(),
  /** Where the event's marker is pinned (eventAnchor), or null for an event with no geometry. */
  anchor: LngLat.nullable(),
  /** The road QLDTraffic names, for the marker's label. */
  road: z.string().nullable(),
  /**
   * The runs this version was in effect at, as [first run, last run] pairs of
   * run times (epoch ms), oldest first. A pair covers every run between its
   * ends; a version that dropped out and came back has two pairs.
   */
  spans: z.array(z.tuple([z.number(), z.number()])),
})
export type HistoryEvent = z.infer<typeof HistoryEvent>

export const EventHistory = z.object({
  /** Runs kept, oldest first. */
  runs: z.array(HistoryRun),
  /** Every event version seen at a kept run, keyed by versionKey() (`<id>@<last_updated>`). */
  events: z.record(z.string(), HistoryEvent),
})
export type EventHistory = z.infer<typeof EventHistory>

/** What /api/history serves: the history, and where it was kept. */
export const HistoryResponse = EventHistory.extend({
  /** 'store': the shared Redis store, written every 5 minutes. 'memory': this server function's own memory, since it started. */
  kept: z.enum(['store', 'memory']),
  /** A note on the record's limits, shown to the viewer, or null. */
  note: z.string().nullable(),
})
export type HistoryResponse = z.infer<typeof HistoryResponse>
