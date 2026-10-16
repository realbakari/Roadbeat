import { Badge, Text } from '@cloudflare/kumo'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { alertActive, alertNextStart, type TransitAlert } from '../api/translink'
import { routeLabels } from '../lib/transitLines'
import { useNow } from '../hooks/useTrafficData'

// Pieces shared by the transit line, route and alert pages.

const when = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Brisbane',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

/** Service alert cards: header, effect, when it starts and the routes it names. */
export function AlertCards({ alerts, onOpen }: { alerts: TransitAlert[]; onOpen: (a: TransitAlert) => void }) {
  const now = useNow(60_000)
  return (
    <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
      {alerts.map((a) => {
        const next = alertActive(a, now) ? null : alertNextStart(a, now)
        return (
          <li key={a.id}>
            <button type="button" onClick={() => onOpen(a)} className="grid w-full gap-1 px-3 py-2.5 text-left hover:bg-kumo-tint">
              <Text bold>{a.header}</Text>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{a.effect}</Badge>
                {next && <Text size="xs" variant="secondary" as="span">From {when.format(next)}</Text>}
                {a.routes.length > 0 && (
                  <Text size="xs" variant="secondary" as="span">
                    {(() => {
                      const labels = routeLabels(a)
                      return `${labels.slice(0, 4).join(', ')}${labels.length > 4 ? ` +${labels.length - 4}` : ''}`
                    })()}
                  </Text>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-4 gap-2">
      <Text as="h3" variant="heading">
        {title}
      </Text>
      {children}
    </section>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline">
      {children}
      <ArrowSquareOutIcon size={14} />
    </a>
  )
}
