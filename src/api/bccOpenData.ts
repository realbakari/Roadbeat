import { z } from 'zod'

// Brisbane City Council's open data portal (data.brisbane.qld.gov.au, CC BY 4.0).
// Every council layer reads the same Explore API v2.1, which sends CORS headers,
// so the browser fetches it directly. One place for the address and the
// request, so each layer only names its dataset.

/** The Explore API's datasets endpoint. */
export const BCC_DATASETS = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets'

/**
 * GETs `path` under the datasets endpoint. A failed response throws
 * "<source> responded with <status>", so each layer keeps its own wording.
 */
export async function bccFetch(path: string, init: RequestInit = {}, source = 'Brisbane City Council'): Promise<Response> {
  const res = await fetch(`${BCC_DATASETS}/${path}`, init)
  if (!res.ok) throw new Error(`${source} responded with ${res.status}`)
  return res
}

/** The response body of `bccFetch` as JSON, unchecked: each caller parses it. */
export async function bccJson(path: string, init?: RequestInit, source?: string): Promise<unknown> {
  return (await bccFetch(path, init, source)).json()
}

/** A dataset's whole JSON export, optionally filtered by Explore API query parameters (`where`, `order_by`). */
export async function bccExport(dataset: string, signal?: AbortSignal, params: Record<string, string> = {}): Promise<unknown[]> {
  const query = new URLSearchParams(params).toString()
  return z.array(z.unknown()).parse(await bccJson(`${dataset}/exports/json${query ? `?${query}` : ''}`, { signal }))
}
