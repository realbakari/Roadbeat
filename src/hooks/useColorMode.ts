import { useCallback, useEffect, useState } from 'react'
import { applyThemeColor } from '../lib/themeColor'

export type ColorMode = 'light' | 'dark'

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(
    () => (document.documentElement.dataset.mode as ColorMode) ?? 'light',
  )

  // The browser toolbar follows the app's chosen mode, not only the system's.
  useEffect(() => applyThemeColor(mode), [mode])

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.mode = next
      try {
        localStorage.setItem('qldt-mode', next)
      } catch {
        // Storage can be unavailable (private mode); the toggle still works for this visit.
      }
      return next
    })
  }, [])

  return { mode, toggle }
}
