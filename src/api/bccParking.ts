import { z } from 'zod'
import { bccJson } from './bccOpenData'

// Vacant spaces at Brisbane City Council's two CBD car parks, King George Square
// and Wickham Terrace (data.brisbane.qld.gov.au "Parking — Stations", CC BY 4.0).

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
  return parseCarParkSpaces(await bccJson('brisbane-parking-stations/records?limit=1', { signal }))
}
