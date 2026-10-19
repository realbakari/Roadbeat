import { Text } from '@cloudflare/kumo'
import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { readableTextOn } from '../lib/routeColor'

/**
 * The heading shared by the place and detail pages: an icon tile in the
 * item's map colour, the title, and a subtitle line, badges, or both. `color`
 * is a #rrggbb hex, so the icon can be drawn in whichever of white or
 * near-black reads better on it.
 */
export function Header({ icon: I, color, title, subtitle, badges }: { icon: Icon; color: string; title: string; subtitle?: string; badges?: ReactNode }) {
  return (
    <header className="flex items-start gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: color, color: readableTextOn(color) }}
        aria-hidden
      >
        <I size={22} weight="fill" />
      </span>
      <div className="grid min-w-0 gap-0.5">
        <Text as="h2" variant="heading" size="lg">
          {title}
        </Text>
        {subtitle && <Text variant="secondary">{subtitle}</Text>}
        {badges && <div className="flex flex-wrap items-center gap-1.5 pt-0.5">{badges}</div>}
      </div>
    </header>
  )
}
