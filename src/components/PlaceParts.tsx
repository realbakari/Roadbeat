import { Text } from '@cloudflare/kumo'
import type { Icon } from '@phosphor-icons/react'

// The heading shared by the place pages (PlaceDetail and HazardPlaces).

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
