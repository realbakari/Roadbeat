/** Scrolled less than this from the top, the controls always show. */
export const REVEAL_TOP = 32
/** Movement smaller than this, in pixels, is ignored so a resting finger doesn't flicker the controls. */
const JITTER = 6

/**
 * Hide-on-scroll-down, show-on-scroll-up for a list's controls.
 * Returns whether the controls should be hidden after the list scrolls from `lastY` to `y`.
 */
export function nextHidden(hidden: boolean, y: number, lastY: number): boolean {
  if (y < REVEAL_TOP) return false
  const delta = y - lastY
  if (delta > JITTER) return true
  if (delta < -JITTER) return false
  return hidden
}
