import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { NewTabNote } from '../NewTabNote'

// Every outbound link opens in a new tab, says so to screen readers, and
// passes no opener or referrer to the official site.

/** The underlined link style used inside running text. Use it directly for links that stay on Roadbeat, such as tel:, mailto: and page links. */
export const linkClass = 'text-kumo-link underline decoration-1 underline-offset-2'

/**
 * A standalone outbound link with the new-tab icon, for the foot of a page or
 * section. `icon` goes before the text, for a link that says what it opens
 * (a PDF, a kiosk board).
 */
export function ExternalLink({ href, icon, title, children }: { href: string; icon?: ReactNode; title?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={`inline-flex w-fit items-center gap-1 text-sm ${linkClass}`}>
      {icon}
      {children}
      <ArrowSquareOutIcon size={14} aria-hidden />
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
