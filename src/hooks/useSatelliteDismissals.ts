import { useState } from 'react'
import { parseDismissed } from '../lib/satelliteSuggestion'

const KEY = 'qldt-satellite-dismissed'

/** The satellite suggestions the rider has closed, remembered in this browser (the latest 50). */
export function useSatelliteDismissals() {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return parseDismissed(localStorage.getItem(KEY))
    } catch {
      return []
    }
  })
  const dismiss = (key: string) => {
    const next = [...dismissed, key]
    setDismissed(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next.slice(-50)))
    } catch {
      // Storage blocked: the dismissal lasts for this visit.
    }
  }
  return [dismissed, dismiss] as const
}
