import { Button, Checkbox, Dialog, Select, TagInput, Text } from '@cloudflare/kumo'
import { XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Stop } from '../api/stops'
import { routesAtStops } from '../api/timetables'
import { routeInfo } from '../api/translink'
import { useStopIndex, useTimetableIndex } from '../hooks/useTransitFeeds'
import { DEFAULT_COMMUTE, type Commute } from '../lib/commute'
import { stopAndChildren } from '../lib/planner'
import { StopField } from './JourneyPlanner'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIMES = Object.fromEntries(
  Array.from({ length: 24 * 12 }, (_, i) => {
    const h = Math.floor(i / 12)
    const m = (i % 12) * 5
    return [String(i * 5), `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`]
  }),
)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  commute: Commute | null
  onSave: (c: Commute | null) => void
}

/** Sets up "My commute": the roads, stop and route a rider travels, and when. */
export function CommuteDialog({ open, onOpenChange, commute, onSave }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="flex max-h-[85vh] flex-col p-0">
        {/* Keyed on `open` so the form starts from the saved commute each time it opens. */}
        <CommuteForm key={String(open)} commute={commute} onSave={onSave} onClose={() => onOpenChange(false)} />
      </Dialog>
    </Dialog.Root>
  )
}

function CommuteForm({ commute, onSave, onClose }: { commute: Commute | null; onSave: (c: Commute | null) => void; onClose: () => void }) {
  const [c, setC] = useState<Commute>(commute ?? DEFAULT_COMMUTE)
  const set = <K extends keyof Commute>(k: K, v: Commute[K]) => setC((x) => ({ ...x, [k]: v }))
  const stops = useStopIndex(true, true)
  const { index } = useTimetableIndex(!!c.stopId)
  const stop = stops?.get(c.region, c.stopId) ?? null

  // Lines and routes that call at the stop, by the name riders use: "T1 Caboolture", "402".
  const routes = useMemo(() => {
    if (!index || !stops || !stop) return []
    const names = routesAtStops(index, stop.region, stopAndChildren(stops, stop)).map((code) => {
      const info = routeInfo(code, stop.region)
      return info?.line ?? info?.short ?? code
    })
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  }, [index, stops, stop])

  const pickStop = (s: Stop | null) => setC((x) => ({ ...x, region: s?.region ?? x.region, stopId: s?.id ?? null, route: null }))
  const canSave = c.days.length > 0 && (c.roads.length > 0 || !!c.stopId)

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 pt-4 pb-3">
        <div className="grid gap-1">
          <Dialog.Title className="text-lg font-semibold text-kumo-strong">My commute</Dialog.Title>
          <Dialog.Description className="text-sm text-kumo-subtle">
            Roadbeat shows one card for your trip from 90 minutes before you leave: your roads, your service and nearby bushfire warnings.
          </Dialog.Description>
        </div>
        <Dialog.Close aria-label="Close" render={(props) => <Button {...props} variant="ghost" shape="square" icon={<XIcon />} aria-label="Close" />} />
      </div>

      <div className="grid gap-5 overflow-y-auto px-5 py-4">
        <TagInput
          label="Roads you drive"
          description="Road names, suburbs or postcodes, for example Ipswich Motorway or Toowong."
          placeholder="Type and press Enter"
          value={c.roads}
          onValueChange={(v: string[]) => set('roads', v)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StopField label="Station or stop you leave from" value={stop} onChange={pickStop} stops={stops} />
          <div className="grid gap-1">
            <Text size="xs" variant="secondary" bold>
              Line or route
            </Text>
            <Select
              aria-label="Line or route"
              className="w-full"
              disabled={!stop}
              value={c.route ? `r:${c.route}` : 'any'}
              onValueChange={(v) => set('route', typeof v === 'string' && v.startsWith('r:') ? v.slice(2) : null)}
              // Keys are prefixed because JavaScript puts numeric keys like "470" before "any".
              items={{ any: stop ? 'Any line or route' : 'Choose a stop first', ...Object.fromEntries(routes.map((r) => [`r:${r}`, r])) }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Text size="xs" variant="secondary" bold>
              Usual departure
            </Text>
            <Select aria-label="Usual departure" className="w-full" value={String(c.minutes)} onValueChange={(v) => set('minutes', Number(v))} items={TIMES} />
          </div>
          <fieldset className="grid gap-1">
            <legend className="pb-1 text-xs font-medium text-kumo-subtle">Days</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Checkbox
                  key={d}
                  label={DAYS[d]}
                  checked={c.days.includes(d)}
                  onCheckedChange={(on: boolean) => set('days', on ? [...c.days, d].sort() : c.days.filter((x) => x !== d))}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-kumo-line px-5 py-3">
        {commute ? (
          <Button
            variant="ghost"
            onClick={() => {
              onSave(null)
              onClose()
            }}
          >
            Remove commute
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          disabled={!canSave}
          title={canSave ? undefined : 'Add a road or a stop, and at least one day'}
          onClick={() => {
            onSave(c)
            onClose()
          }}
        >
          Save commute
        </Button>
      </div>
    </>
  )
}
