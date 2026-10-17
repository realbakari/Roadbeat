import { useEffect, useEffectEvent, useRef, useState } from 'react'

/**
 * Text for a `role="status"` region that speaks `message` a moment after `key`
 * changes, such as a result count after a search or filter. It stays quiet on
 * first render and when the data refreshes under an unchanged key, and waits
 * for typing to pause so each keystroke isn't read out.
 */
export function useAnnouncement(key: string, message: string, delayMs = 700): string {
  const [text, setText] = useState('')
  const latest = useEffectEvent(() => setText(message))
  const lastKey = useRef(key)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    const id = setTimeout(latest, delayMs)
    return () => clearTimeout(id)
  }, [key, delayMs])
  return text
}
