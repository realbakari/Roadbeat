import { Badge, Button, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, TrafficSignalIcon } from '@phosphor-icons/react'
import { SIGNALS_DATASET_URL, type ApproachReading, type SignalSite } from '../api/bccSignals'
import { dsColor, siteLoad } from '../lib/signals'
import { ExternalLink } from './ui/Links'
import { brisbaneClock as time } from '../lib/aest'
import { RelativeTime } from './ui/RelativeTime'

/**
 * A Brisbane City Council signalised intersection with its latest measured
 * cycle on each approach: every lane's degree of saturation and vehicle count.
 */
export function SignalDetail({
  site,
  approaches,
  now,
  onBack,
}: {
  site: SignalSite
  approaches: ApproachReading[] | null
  now: number
  onBack: () => void
}) {
  const load = approaches ? siteLoad(approaches) : null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-5 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: load ? dsColor(load.maxDs) : '#64748b' }}
              aria-hidden
            >
              <TrafficSignalIcon size={22} weight="fill" />
            </span>
            <div className="grid min-w-0 gap-1">
              <Text as="h2" variant="heading" size="lg">
                {site.streets.length ? site.streets.join(' & ') : `Signal ${site.tsc}`}
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {site.suburb && <Badge variant="outline">{site.suburb}</Badge>}
                <Badge variant="outline">Signal {site.tsc}</Badge>
              </div>
            </div>
          </header>

          {!approaches || !load ? (
            <Text variant="secondary">No measured volumes from this intersection in the council's live feed right now.</Text>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Stat value={`${Math.round(load.maxDs)}%`} label="Busiest lane saturation" color={dsColor(load.maxDs)} />
                <Stat value={String(load.vehicles)} label="Vehicles in the last cycle" />
                <Stat value={`${approaches[0].cycle} s`} label="Signal cycle" />
              </div>
              <Text size="sm" variant="secondary">
                Measured {time.format(load.recorded)} AEST · <RelativeTime at={load.recorded} now={now} inline />. Degree of saturation is the average time a
                lane's detector was occupied, as a percentage, as the council's SCATS system measures it.
              </Text>

              <section className="grid gap-2">
                <Text as="h3" variant="heading">
                  Approaches
                </Text>
                <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
                  {approaches.map((a) => (
                    <li key={a.id} className="grid gap-1.5 px-3 py-2">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">Approach {a.id.replace(/^SA-/, '')}</span>
                        <span className="text-xs text-kumo-subtle">{time.format(a.recorded)}</span>
                      </span>
                      {a.lanes.map((l, i) => (
                        <span key={i} className="grid grid-cols-[3.5rem_1fr_6.5rem] items-center gap-2 text-xs">
                          <span className="text-kumo-subtle">Lane {i + 1}</span>
                          <span className="h-2 overflow-hidden rounded-full bg-kumo-recessed">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.min(100, l.ds)}%`, backgroundColor: dsColor(l.ds) }}
                            />
                          </span>
                          <span className="text-right tabular-nums">
                            {Math.round(l.ds)}% · {l.vehicles} {l.vehicles === 1 ? 'vehicle' : 'vehicles'}
                          </span>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <Text size="xs" variant="secondary">
                  Approaches are SCATS strategic approaches. The council doesn't publish which street each one is, so they're
                  listed by number.
                </Text>
              </section>
            </>
          )}

          <div className="grid gap-1">
            <ExternalLink href={SIGNALS_DATASET_URL}>Brisbane City Council intersection volumes</ExternalLink>
            <Text size="xs" variant="secondary">
              Measured by the council's SCATS signal system. Only council-operated signals are included. CC BY 4.0.
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <span className="grid leading-tight">
      <span className="text-base font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="text-xs text-kumo-subtle">{label}</span>
    </span>
  )
}
