import { Text } from '@cloudflare/kumo'
import { ArrowsVerticalIcon } from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import { BCC_CLEARANCES_URL, clearanceLabel, QR_BRIDGES_URL, QR_CLEARANCES_URL, type Clearance } from '../../api/clearances'
import { formatDay, titleCase } from '../../lib/format'
import { LAYER_COLOR } from '../../lib/mapIcons'
import { Header } from '../PlaceParts'
import { ExternalLink } from '../ui/Links'
import { Section } from '../ui/Section'
import { Directions } from './Directions'

// Owner codes the council's dataset uses.
const OWNERS: Record<string, string> = { BCC: 'Brisbane City Council', TMR: 'Transport and Main Roads' }
const owner = (s: string | null) => (s ? (OWNERS[s] ?? titleCase(s)) : null)

export function ClearanceBody({ c }: { c: Clearance }) {
  const qr = c.source === 'qr'
  const dated = formatDay(c.dated)
  const rows: [string, ReactNode][] = []
  if (c.category) rows.push(['Category', c.category])
  if (c.owner) rows.push(['Structure owner', <Contact key="owner" name={owner(c.owner)} phone={c.ownerPhone} />])
  if (c.roadOwner) rows.push(['Road owner', <Contact key="road" name={owner(c.roadOwner)} phone={c.roadOwnerPhone} />])
  rows.push([qr ? 'Extract dated' : 'Validated', dated ?? 'Not published'])
  return (
    <>
      <Header
        icon={ArrowsVerticalIcon}
        color={LAYER_COLOR.clearance}
        ink="#111"
        title={c.title}
        subtitle={qr ? `Queensland Rail bridge${c.suburb ? `, ${c.suburb}` : ''}` : 'Brisbane City Council low clearance'}
      />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          Signed clearance
        </Text>
        <span className="text-3xl font-semibold tabular-nums">{clearanceLabel(c.metres)}</span>
        <Text size="sm" variant="secondary">
          The height on the sign, as {qr ? 'Queensland Rail' : 'the council'} published it. Clearances change with roadworks and not every low
          structure is listed, so always obey the signs on the road.
        </Text>
      </div>
      <Section title="Details">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-kumo-subtle">{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>
      <div className="grid gap-1.5">
        <ExternalLink href={qr ? QR_CLEARANCES_URL : BCC_CLEARANCES_URL}>
          {qr ? 'Road height restrictions — Queensland Rail' : 'Road height restrictions — Brisbane City Council'}
        </ExternalLink>
        {qr && <ExternalLink href={QR_BRIDGES_URL}>Queensland Rail: rail bridges</ExternalLink>}
      </div>
      <Directions at={c.position} />
    </>
  )
}

function Contact({ name, phone }: { name: string | null; phone: string | null }) {
  return (
    <>
      {name}
      {phone && (
        <>
          {name && ' · '}
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="text-kumo-link underline decoration-1 underline-offset-2">
            {phone}
          </a>
        </>
      )}
    </>
  )
}
