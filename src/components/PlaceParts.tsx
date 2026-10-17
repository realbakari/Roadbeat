import { Text } from '@cloudflare/kumo'
import { ArrowSquareOutIcon, type Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { NewTabNote } from './NewTabNote'

// The heading, section and outbound link shared by the place pages (PlaceDetail and HazardPlaces).

export function Header({ icon: I, color, ink = '#fff', title, subtitle }: { icon: Icon; color: string; ink?: string; title: string; subtitle: string }) {
  return (
    <header className="flex items-start gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: color, color: ink }}
        aria-hidden
      >
        <I size={22} weight="fill" />
      </span>
      <div className="grid min-w-0 gap-0.5">
        <Text as="h2" variant="heading" size="lg">
          {title}
        </Text>
        <Text variant="secondary">{subtitle}</Text>
      </div>
    </header>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <Text as="h3" variant="heading">
        {title}
      </Text>
      <div>{children}</div>
    </section>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link underline decoration-1 underline-offset-2">
      {children}
      <ArrowSquareOutIcon size={14} />
      <NewTabNote />
    </a>
  )
}
