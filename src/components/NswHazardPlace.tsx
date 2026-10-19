import { Badge, Text } from '@cloudflare/kumo'
import { WarningIcon } from '@phosphor-icons/react'
import { NSW_HAZARD_COLOR, NSW_HAZARD_LABEL, NSW_HAZARDS_ATTRIBUTION, nswHazardHeading, nswHazardPage, type NswHazard } from '../api/nswHazards'
import { brisbaneDayDateTime as aest } from '../lib/aest'
import { Header } from './PlaceParts'
import { PublishedText } from './PublishedText'
import { ExternalLink } from './ui/Links'
import { Facts } from './ui/Facts'
import { Section } from './ui/Section'
import { RelativeTime } from './ui/RelativeTime'

const at = (t: number | null) => (t ? `${aest.format(t)} AEST` : null)

/** One Transport for NSW road hazard near the border, every field as published, with times in Brisbane time. */
export function NswHazardBody({ h, now }: { h: NswHazard; now: number }) {
  const road = h.roads[0]
  return (
    <>
      <Header
        icon={WarningIcon}
        color={h.major ? NSW_HAZARD_COLOR.major : NSW_HAZARD_COLOR.normal}
        title={road?.street ?? nswHazardHeading(h)}
        subtitle={`Transport for NSW · ${NSW_HAZARD_LABEL[h.kind]}`}
      />
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{nswHazardHeading(h)}</Badge>
        {h.incidentKind && <Badge variant="outline">{h.incidentKind}</Badge>}
        {h.major && <Badge variant="secondary">Major</Badge>}
      </div>
      <Text size="sm" variant="secondary">
        In New South Wales, near the Queensland border, as Transport for NSW publishes it.
        {h.lastUpdated && (
          <>
            {' '}
            Updated <RelativeTime at={h.lastUpdated} now={now} />.
          </>
        )}
      </Text>

      {h.roads.length > 0 && (
        <Section title="Where">
          <ul className="grid gap-2">
            {h.roads.map((r, i) => (
              <li key={`${r.street}-${i}`} className="grid gap-0.5 text-sm">
                <span className="font-medium">{[r.street, r.qualifier && r.cross ? `${r.qualifier} ${r.cross}` : r.cross].filter(Boolean).join(' ')}</span>
                {(r.suburb || r.region) && <span className="text-kumo-subtle">{[r.suburb, r.region].filter(Boolean).join(' · ')}</span>}
                {r.lanes.map((l, j) => (
                  <span key={j}>{[l.direction, l.description, l.extent].filter(Boolean).join(' · ')}</span>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {h.schedule.length > 0 && (
        <Section title="Schedule (NSW time)">
          <ul className="grid gap-0.5 text-sm">
            {h.schedule.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>
      )}
      {h.advice.length > 0 && (
        <Section title="Advice">
          <ul className="list-disc pl-5 text-sm">
            {h.advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
      )}
      {h.otherAdvice && (
        <Section title="More information">
          <PublishedText text={h.otherAdvice} />
        </Section>
      )}
      {h.diversions && (
        <Section title="Diversions">
          <PublishedText text={h.diversions} />
        </Section>
      )}

      <Section title="As published">
        <Facts
          rows={[
            ['Started', at(h.start)],
            ['Ends', at(h.end)],
            ['Reported', at(h.created)],
            ['Last updated', at(h.lastUpdated)],
            ['Expected delay', h.expectedDelay != null ? `${h.expectedDelay} min` : null],
            ['Speed limit', h.speedLimit != null ? `${h.speedLimit} km/h` : null],
            ['Attending', h.attending.join(', ') || null],
          ]}
        />
      </Section>

      <div className="grid gap-1">
        <ExternalLink href={nswHazardPage(h)}>On Live Traffic NSW</ExternalLink>
        <Text size="xs" variant="secondary">
          {NSW_HAZARDS_ATTRIBUTION}.
        </Text>
      </div>
    </>
  )
}
