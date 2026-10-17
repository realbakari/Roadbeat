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

/** A level's name on screen. QFD's 'Information' is a fire it has reported, not a warning. */
export const FIRE_LEVEL_LABEL: Record<FireLevel, string> = {
  'Emergency Warning': 'Emergency Warning',
  'Watch and Act': 'Watch and Act',
  Advice: 'Advice',
  Information: 'Fire reported',
}

/**
 * Text classes for a level's name, in the same hues as FIRE_COLOR but shaded
 * to keep at least 4.5:1 on light and dark surfaces. The warning colours are
 * for markers: orange and yellow are too light for text on white.
 */
export const FIRE_TEXT: Record<FireLevel, string> = {
  'Emergency Warning': 'text-[#b91c1c] dark:text-[#f87171]',
  'Watch and Act': 'text-[#b54300] dark:text-[#ff9a3d]',
  Advice: 'text-[#854d0e] dark:text-[#facc15]',
  Information: 'text-[#4b5563] dark:text-[#9ca3af]',
}

/** Badge classes for a level: the warning colour itself, with whichever of white or near-black text reads on it. */
export const FIRE_BADGE: Record<FireLevel, string> = {
  'Emergency Warning': 'bg-[#d6001c] text-[#ffffff]',
  'Watch and Act': 'bg-[#ff7900] text-[#1d1d1d]',
  Advice: 'bg-[#e8b400] text-[#1d1d1d]',
  Information: 'bg-[#6b7280] text-[#ffffff]',
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
