import { nearAustralia, type Cyclone } from '../api/jtwc'
import type { QldWarning } from '../api/qldWarnings'

/** A prompt to switch to the live satellite view, keyed by what raised it so a dismissal sticks to that storm or warning. */
export interface SatelliteSuggestion {
  key: string
  text: string
}

/** A warning whose published WarningType names a cyclone or a thunderstorm. Nothing is read into its text or area. */
function stormWarning(w: QldWarning): boolean {
  return /cyclone|thunderstorm/i.test(w.type ?? '')
}

/**
 * Whether official data calls for the live satellite view: a storm JTWC is
 * warning on with a published position in 90° to 170° E, 0° to 40° S
 * (`nearAustralia`), or a Queensland warning published
 * as a cyclone or thunderstorm warning. Highest Queensland warning first, then
 * cyclones. Null when nothing does, or every one has been dismissed.
 */
export function satelliteSuggestion(cyclones: Cyclone[], warnings: QldWarning[], dismissed: readonly string[]): SatelliteSuggestion | null {
  for (const w of warnings) {
    const key = `warning:${w.id}`
    if (stormWarning(w) && !dismissed.includes(key)) {
      return { key, text: `${w.levelText}: ${w.type} warning${w.area ? ` for ${w.area}` : ''}. Show the live satellite view?` }
    }
  }
  for (const c of cyclones) {
    const key = `cyclone:${c.id}`
    if (nearAustralia(c) && !dismissed.includes(key)) return { key, text: `Cyclone ${c.name ?? c.id} near Australia (JTWC): show the live satellite view?` }
  }
  return null
}

/** The dismissed keys as stored, or none when the stored value isn't a list of strings. */
export function parseDismissed(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
