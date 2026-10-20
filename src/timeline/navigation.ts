import type { MouseEvent } from 'react'
import type { PostView } from '../lib/posts'

/** The timeline's tabs, in order, with the key that picks each. */
export const VIEWS: { value: PostView; label: string; short?: string; key: string }[] = [
  { value: 'latest', label: 'Latest', key: '1' },
  { value: 'major', label: 'Major', key: '2' },
  { value: 'active', label: 'Most active', short: 'Active', key: '3' },
  { value: 'watching', label: 'Watching', key: '4' },
  { value: 'fuel', label: 'Fuel', key: '5' },
]

/** A plain left click, which the timeline handles itself; a click meant for a new tab or window goes to the browser. */
export const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [tabindex="0"]'

/** Whether a click landed on something with its own action, which a clickable card must leave alone. */
export const isInteractive = (target: Element) => target.closest(INTERACTIVE) != null
