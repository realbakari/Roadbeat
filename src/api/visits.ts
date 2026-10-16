// The visitor count shown in the header, from Roadbeat's own /api/visits
// (api/_lib/endpoints/visits.ts). The server keeps only estimates of how many
// browsers were seen today and in the last ten minutes, never who they were.

export interface Visitors {
  /** Browsers seen in the last ten minutes. */
  online: number
  /** Browsers seen today, Brisbane time. */
  today: number
  /** When the server counted. */
  at: number
}

/** Tells the server this browser is here. Fire and forget: a missed ping only undercounts. */
export async function pingVisit(signal?: AbortSignal): Promise<void> {
  try {
    await fetch('/api/visits', { method: 'POST', keepalive: true, signal })
  } catch {
    // Offline, blocked or not deployed: nothing to do.
  }
}

/** The current counts, or null where the server has no store or can't be reached. */
export async function fetchVisitors(signal?: AbortSignal): Promise<Visitors | null> {
  try {
    const res = await fetch('/api/visits', { signal })
    if (!res.ok) return null
    const body = (await res.json()) as { available?: boolean; online?: number; today?: number; at?: number }
    if (!body.available) return null
    return { online: body.online ?? 0, today: body.today ?? 0, at: body.at ?? Date.now() }
  } catch {
    return null
  }
}
