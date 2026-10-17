import { Badge, Button, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, ArrowSquareOutIcon, FlameIcon } from '@phosphor-icons/react'
import { FIRE_BADGE, FIRE_COLOR, fireKindLabel, type FireWarning } from '../api/bushfires'
import { timeAgo } from '../lib/format'
import { readableTextOn } from '../lib/routeColor'
import { NewTabNote } from './NewTabNote'
import { PublishedText, TextPart } from './PublishedText'

const when = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Brisbane',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

/** QFD's own pages for current warnings and incidents. */
const QFD_WARNINGS = 'https://www.fire.qld.gov.au/Current-Incidents'

/** A bushfire warning or incident exactly as the Queensland Fire Department publishes it. */
export function FireDetail({ fire, now, onBack }: { fire: FireWarning; now: number; onBack: () => void }) {
  const color = FIRE_COLOR[fire.level]
  const warning = fire.level !== 'Information'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          All events
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-5 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: color, color: readableTextOn(color) }} aria-hidden>
              <FlameIcon size={22} weight="fill" />
            </span>
            <div className="grid min-w-0 gap-1">
              <Text as="h2" variant="heading" size="lg">
                {fire.area ?? fire.title}
              </Text>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className={FIRE_BADGE[fire.level]}>
                  {warning ? fire.levelText : fireKindLabel(fire)}
                </Badge>
                {fire.status && <Badge variant="outline">{fire.status}</Badge>}
                {warning && <Badge variant="outline">{fireKindLabel(fire)}</Badge>}
              </div>
            </div>
          </header>

          {fire.callToAction && warning && (
            <div className="flex overflow-hidden rounded-lg ring ring-kumo-line">
              <span className="w-1 shrink-0" style={{ backgroundColor: color }} aria-hidden />
              <div className="grid gap-1 px-3 py-2.5">
                <Text bold>{fire.callToAction}</Text>
                {fire.header && <PublishedText text={fire.header} />}
              </div>
            </div>
          )}
          {!warning && fire.text && <PublishedText text={fire.text} />}

          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            {fire.location && (
              <>
                <dt className="text-kumo-subtle">Location</dt>
                <dd>{fire.location}</dd>
              </>
            )}
            {fire.issued && (
              <>
                <dt className="text-kumo-subtle">Issued</dt>
                <dd>
                  {when.format(fire.issued)} <span className="text-kumo-subtle">· {timeAgo(fire.issued, now)}</span>
                </dd>
              </>
            )}
            {fire.published && (
              <>
                <dt className="text-kumo-subtle">Last published</dt>
                <dd>{when.format(fire.published)}</dd>
              </>
            )}
            {fire.expires && (
              <>
                <dt className="text-kumo-subtle">Expires</dt>
                <dd>{when.format(fire.expires)}</dd>
              </>
            )}
          </dl>

          {warning && (
            <>
              <TextPart title="Impacts">{fire.impacts}</TextPart>
              <TextPart title="What you should do">{fire.shouldDo}</TextPart>
              <TextPart title="Leaving safely">{fire.leaveSafely}</TextPart>
              <TextPart title="More information">{fire.further}</TextPart>
            </>
          )}

          <div className="grid gap-1">
            <a href={QFD_WARNINGS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link underline decoration-1 underline-offset-2">
              Current incidents on the Queensland Fire Department site <ArrowSquareOutIcon size={14} />
              <NewTabNote />
            </a>
            <Text size="xs" variant="secondary">
              Source: Queensland Fire Department, data.qld.gov.au (CC BY 4.0). If you are in danger, call Triple Zero (000).
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
