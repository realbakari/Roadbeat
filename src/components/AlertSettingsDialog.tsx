import { Banner, Button, Checkbox, Dialog, Select, Switch, TagInput, Text } from '@cloudflare/kumo'
import { InfoIcon, NavigationArrowIcon, XIcon } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import type { TrafficEvent } from '../api/types'
import { ALERT_KINDS, alertArea, type AlertSettings } from '../lib/alertRules'
import { currentPosition } from '../lib/position'
import { eventTitle } from '../lib/eventText'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: AlertSettings
  onChange: (s: AlertSettings) => void
  districts: string[]
  events: TrafficEvent[]
}

const RADII = { '5': 'Within 5 km', '10': 'Within 10 km', '25': 'Within 25 km', '50': 'Within 50 km', '100': 'Within 100 km' }

/** Asks for the browser's permission to show system notifications, unless it has already been given or refused. */
async function requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function AlertSettingsDialog({ open, onOpenChange, settings: s, onChange, districts, events }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const set = <K extends keyof AlertSettings>(k: K, v: AlertSettings[K]) => onChange({ ...s, [k]: v })

  const enableBrowser = async (on: boolean) => {
    if (!on) return set('browser', false)
    const p = await requestBrowserPermission()
    setPermission(p)
    set('browser', p === 'granted')
  }

  const enableNearMe = (on: boolean) => {
    if (!on) return set('nearMe', null)
    setLocating(true)
    setLocateError(null)
    currentPosition().then(
      (at) => (setLocating(false), set('nearMe', { at, km: s.nearMe?.km ?? 25 })),
      (e: Error) => (setLocating(false), setLocateError(e.message)),
    )
  }
  const area = alertArea(s)

  const watched = s.watchedEvents
    .map((id) => events.find((e) => e.properties.id === id))
    .filter((e): e is TrafficEvent => !!e)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="flex max-h-[85vh] flex-col p-0">
        <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 pt-4 pb-3">
          <div className="grid gap-1">
            <Dialog.Title className="text-lg font-semibold text-kumo-strong">Notification settings</Dialog.Title>
            <Dialog.Description className="text-sm text-kumo-subtle">
              Choose what Roadbeat should alert you about.
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="Close"
            render={(props) => <Button {...props} variant="ghost" shape="square" icon={<XIcon />} aria-label="Close" />}
          />
        </div>

        <div className="grid gap-6 overflow-y-auto px-5 py-4">
          <Section title="How">
            <div className="grid gap-2">
              <Switch label="Show alerts in the app" checked={s.inApp} onCheckedChange={(v: boolean) => set('inApp', v)} />
              <Switch
                label="System notifications when this tab is in the background"
                checked={s.browser && permission === 'granted'}
                disabled={permission === 'unsupported' || permission === 'denied'}
                onCheckedChange={enableBrowser}
              />
              {permission === 'denied' && (
                <Text size="sm" variant="secondary">
                  Notifications are blocked for this site. Allow them in your browser's site settings to turn this on.
                </Text>
              )}
            </div>
          </Section>

          <Section title="What">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {ALERT_KINDS.map((k) => (
                <Checkbox
                  key={k.key}
                  label={k.label}
                  checked={s.kinds[k.key]}
                  onCheckedChange={(v: boolean) => set('kinds', { ...s.kinds, [k.key]: v })}
                />
              ))}
            </div>
          </Section>

          <Section
            title="Where"
            hint={
              area === 'places'
                ? 'Only events matching at least one of these.'
                : area === 'everywhere'
                  ? 'Anywhere in Queensland. Add places to narrow it down.'
                  : "Not chosen yet, so you'll only hear about events you watch and your routes. Add places, or choose anywhere in Queensland."
            }
          >
            <div className="grid gap-4">
              {area !== 'places' && (
                <Switch label="Anywhere in Queensland" checked={s.everywhere} onCheckedChange={(v: boolean) => set('everywhere', v)} />
              )}
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Switch label="Near me" checked={!!s.nearMe} onCheckedChange={enableNearMe} />
                  {s.nearMe && (
                    <Select
                      aria-label="Distance"
                      size="sm"
                      value={String(s.nearMe.km)}
                      onValueChange={(v) => set('nearMe', { ...s.nearMe!, km: Number(v) })}
                      items={RADII}
                    />
                  )}
                  {locating && (
                    <Text size="sm" variant="secondary" as="span">
                      <NavigationArrowIcon className="inline" /> Finding you…
                    </Text>
                  )}
                </div>
                {locateError && (
                  <Text size="sm" variant="error">
                    {locateError}
                  </Text>
                )}
              </div>
              <TagInput
                label="Roads, suburbs or postcodes"
                description="For example: Bruce Highway, Toowong, 4350."
                placeholder="Type and press Enter"
                value={s.roads}
                onValueChange={(v: string[]) => set('roads', v)}
              />
              <div className="grid gap-1.5">
                <Text size="sm" bold>
                  Districts
                </Text>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {districts.map((d) => (
                    <Checkbox
                      key={d}
                      label={d}
                      checked={s.districts.includes(d)}
                      onCheckedChange={(v: boolean) =>
                        set('districts', v ? [...s.districts, d] : s.districts.filter((x) => x !== d))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Public transport" hint="Alerts when Translink posts a disruption on these routes or lines.">
            <TagInput
              label="Routes and lines"
              description="Bus or ferry numbers (402, F1), or a train line station (Caboolture, Ipswich)."
              placeholder="Type and press Enter"
              value={s.routes}
              onValueChange={(v: string[]) => set('routes', v)}
            />
          </Section>

          {watched.length > 0 && (
            <Section title="Watched events" hint="You'll hear when these change or clear.">
              <ul className="grid gap-1.5">
                {watched.map((e) => (
                  <li key={e.properties.id} className="flex items-center justify-between gap-2 rounded-lg bg-kumo-recessed px-3 py-1.5">
                    <Text size="sm" truncate>
                      {e.properties.event_type} · {eventTitle(e)}
                    </Text>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => set('watchedEvents', s.watchedEvents.filter((x) => x !== e.properties.id))}
                    >
                      Stop watching
                    </Button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Banner
            variant="secondary"
            size="sm"
            icon={<InfoIcon weight="fill" />}
            description="Alerts are checked every minute while Roadbeat is open in a browser tab. With system notifications on, road events, Translink alerts, bushfire, storm, flood and cyclone warnings and news keep being checked while the tab is in the background, though browsers may check a background tab less often. Anything that happened while Roadbeat was closed shows up here when you come back."
          />
        </div>
      </Dialog>
    </Dialog.Root>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <div className="grid gap-0.5">
        <Text as="h3" variant="heading">
          {title}
        </Text>
        {hint && (
          <Text size="sm" variant="secondary">
            {hint}
          </Text>
        )}
      </div>
      {children}
    </section>
  )
}
