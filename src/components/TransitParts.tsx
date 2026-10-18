import { Badge, Text } from '@cloudflare/kumo'
import type { ReactNode } from 'react'
import { alertActive, alertNextStart, type TransitAlert } from '../api/translink'
import { routeLabels } from '../lib/transitLines'
import { useNow } from '../hooks/useNow'
import { Section as SharedSection } from './ui/Section'
import { brisbaneDayDateTime as when } from '../lib/aest'

// Pieces shared by the transit line, route and alert pages.

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

/** Transit sections lay each child on the section's gap, and some carry an id to scroll to. */
export function Section(props: { title: string; id?: string; children: ReactNode }) {
  return <SharedSection {...props} spaced />
}
