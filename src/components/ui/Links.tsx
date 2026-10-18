import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { NewTabNote } from '../NewTabNote'

// Every outbound link opens in a new tab, says so to screen readers, and
// passes no opener or referrer to the official site.

/** The underlined link style used inside running text. */
export const linkClass = 'text-kumo-link underline decoration-1 underline-offset-2'

/** A standalone outbound link with the new-tab icon, for the foot of a page or section. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-sm ${linkClass}`}>
      {children}
      <ArrowSquareOutIcon size={14} />
      <NewTabNote />
    </a>
  )
}

/** An outbound link inside a sentence. */
export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
      <NewTabNote />
    </a>
  )
}
