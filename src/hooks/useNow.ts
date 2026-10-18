import { useEffect, useState } from 'react'

/**
 * Re-renders on an interval so relative timestamps stay fresh. The clock
 * stops while the tab is hidden and catches up the moment it's shown again,
 * so background tabs don't re-render for nothing.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined
    const start = () => {
      clearInterval(id)
      id = setInterval(() => setNow(Date.now()), intervalMs)
    }
    const onVisibility = () => {
      if (document.hidden) clearInterval(id)
      else {
        setNow(Date.now())
        start()
      }
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])
  return now
}
