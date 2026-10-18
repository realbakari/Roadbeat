import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A "Copied" flag that turns itself off after `ms`, for the brief tick after
 * copying a link. The timer is cleared on unmount so a closed page doesn't
 * set state after it's gone.
 */
export function useCopied(ms: number): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback(() => {
    clearTimeout(timer.current)
    setCopied(true)
    timer.current = setTimeout(() => setCopied(false), ms)
  }, [ms])
  return [copied, flash]
}
