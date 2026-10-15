import { parseBushfires, type FireLevel, type FireWarning } from './bushfireFeed'

// Queensland Fire Department current bushfire incidents and warnings
// (data.qld.gov.au "Queensland Fire Department current bushfire incidents",
// CC BY 4.0), read through /qfd-bushfires (see vite.config.ts and
// functions/qfd-bushfires). Every field is shown as QFD publishes it.

const URL_ = import.meta.env.VITE_QFD_BUSHFIRES_URL ?? '/qfd-bushfires'

export { FIRE_LEVELS, fireRank, parseBushfires, type FireLevel, type FireWarning } from './bushfireFeed'

/** The warning system's own colours (red, orange, yellow), and grey for incidents. */
export const FIRE_COLOR: Record<FireLevel, string> = {
  'Emergency Warning': '#d6001c',
  'Watch and Act': '#ff7900',
  Advice: '#e8b400',
  Information: '#6b7280',
}

export async function fetchBushfires(signal?: AbortSignal): Promise<FireWarning[]> {
  const res = await fetch(URL_, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Queensland Fire Department feed responded with ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Bushfire feed proxy is not configured')
  return parseBushfires(await res.json())
}

/** "Bushfire" or "Planned burn", from QFD's incident type. */
export function fireKindLabel(f: FireWarning) {
  return f.kind?.includes('PERMITTED') ? 'Planned burn' : 'Bushfire'
}
