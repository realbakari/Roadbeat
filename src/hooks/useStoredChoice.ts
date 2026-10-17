import { useCallback, useState } from 'react'

/**
 * A choice remembered in this browser under `key`, read once on load through
 * `parse` (anything it rejects gives `fallback`). Storage that is blocked or
 * full only means the choice lasts for this visit.
 */
export function useStoredChoice<T extends string>(key: string, parse: (v: string | null) => T | null, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return parse(localStorage.getItem(key)) ?? fallback
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, v)
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
    },
    [key],
  )
  return [value, set] as const
}
