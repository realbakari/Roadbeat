import { Badge, Text } from '@cloudflare/kumo'
import { WarningIcon } from '@phosphor-icons/react'
import { QLD_WARNINGS_PAGE, WARNING_BADGE, WARNING_COLOR, type QldWarning } from '../api/qldWarnings'
import { readableTextOn } from '../lib/routeColor'
import { ExternalLink } from './ui/Links'
import { PublishedText, TextPart } from './PublishedText'

/**
 * A Queensland severe weather, flood, cyclone or other hazard warning, exactly
 * as Queensland Disaster Management publishes it. The issue time is the one
 * written in the warning's title; the feed's own timestamps are when it was
 * regenerated, so they aren't shown as the warning's.
 */
export function WarningBody({ w }: { w: QldWarning }) {
  const color = WARNING_COLOR[w.level]
  const rows: [string, string][] = []
  if (w.issued) rows.push(['Issued', `${w.issued} (AEST)`])
  if (w.nextUpdate) rows.push(['Next update', w.nextUpdate])
  if (w.from) rows.push(['Issued by', w.from])
  if (w.type) rows.push(['Hazard', w.type])
  if (w.callToAction) rows.push(['Call to action', w.callToAction])
  return (
    <>
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: color, color: readableTextOn(color) }} aria-hidden>
          <WarningIcon size={22} weight="fill" />
        </span>
        <div className="grid min-w-0 gap-1">
          <Text as="h2" variant="heading" size="lg">
            {w.area ?? 'Queensland warning'}
          </Text>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className={WARNING_BADGE[w.level]}>
              {w.levelText}
            </Badge>
            {w.type && <Badge variant="outline">{w.type}</Badge>}
          </div>
        </div>
      </header>

      <div className="flex overflow-hidden rounded-lg ring ring-kumo-line">
        <span className="w-1 shrink-0" style={{ backgroundColor: color }} aria-hidden />
        <div className="grid gap-2 px-3 py-2.5">
          <Text bold>{w.title}</Text>
          {w.header && <PublishedText text={w.header} />}
        </div>
      </div>

      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-kumo-subtle">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <TextPart title="Impacts">{w.impacts}</TextPart>
      <TextPart title="What you should do">{w.shouldDo}</TextPart>
      <TextPart title="More information">{w.moreInformation}</TextPart>

      <div className="grid gap-1">
        <ExternalLink href={QLD_WARNINGS_PAGE}>Current warnings on disaster.qld.gov.au</ExternalLink>
        <Text size="xs" variant="secondary">
          {w.from ? `Warning from ${w.from}, via` : 'Source:'} Queensland Disaster Management, disaster.qld.gov.au (CC BY 4.0). The map shows the area as
          published. If you are in danger, call Triple Zero (000).
        </Text>
      </div>
    </>
  )
}
