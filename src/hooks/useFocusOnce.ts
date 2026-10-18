import { useEffect, useEffectEvent, useRef } from 'react'

/**
 * Runs `focus` once each time `key` names a new item, not on every refresh of
 * the same one, so the map flies to a picked fire or vehicle without
 * snapping back after the rider pans away. With `forgetOnClear`, closing the
 * item lets the same one fly again when it's picked next.
 */
export function useFocusOnce<T>(target: T | null, key: string | null, focus: (target: T) => void, forgetOnClear = false) {
  const focused = useRef<string | null>(null)
  const onFocus = useEffectEvent(focus)
  useEffect(() => {
    if (target == null || key == null) {
      if (forgetOnClear) focused.current = null
      return
    }
    if (focused.current === key) return
    focused.current = key
    onFocus(target)
  }, [target, key, forgetOnClear])
}
