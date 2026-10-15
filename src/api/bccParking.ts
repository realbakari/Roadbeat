import { z } from 'zod'

// Vacant spaces at Brisbane City Council's two CBD car parks, King George Square
// and Wickham Terrace (data.brisbane.qld.gov.au "Parking — Stations", CC BY 4.0).

export const PARKING_URL = 'https://data.brisbane.qld.gov.au/explore/dataset/brisbane-parking-stations/information/'
const API = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/brisbane-parking-stations/records?limit=1'

export interface CarParkSpaces {
  /** When the council published the counts (ms). */
  at: number
  kingGeorgeSquare: number | null
  wickhamTerrace: number | null
}

const count = z.number().int().nonnegative().nullish().transform((n) => n ?? null)
const Body = z.object({
  results: z.array(z.object({ uploaded_to_open_data_at: z.string(), king_george_square: count, wickham_terrace: count })),
})

export function parseCarParkSpaces(json: unknown): CarParkSpaces | null {
  const r = Body.parse(json).results[0]
  return r ? { at: Date.parse(r.uploaded_to_open_data_at), kingGeorgeSquare: r.king_george_square, wickhamTerrace: r.wickham_terrace } : null
}

export async function fetchCarParkSpaces(signal?: AbortSignal): Promise<CarParkSpaces | null> {
  const res = await fetch(API, { signal })
  if (!res.ok) throw new Error(`Brisbane City Council responded with ${res.status}`)
  return parseCarParkSpaces(await res.json())
}
