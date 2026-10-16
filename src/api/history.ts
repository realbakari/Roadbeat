import { HistoryResponse } from './historyTypes'

/** The road event history, from api/history.ts (or the dev server's /api/history). */
export const HISTORY_URL: string = import.meta.env.VITE_HISTORY_URL ?? '/api/history'

export async function fetchHistory(signal?: AbortSignal): Promise<HistoryResponse> {
  const res = await fetch(HISTORY_URL, { signal })
  if (!res.ok) throw new Error(`Event history responded with ${res.status}`)
  return HistoryResponse.parse(await res.json())
}
