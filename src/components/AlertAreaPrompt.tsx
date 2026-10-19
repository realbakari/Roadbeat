import { Button, Text } from '@cloudflare/kumo'
import { GlobeHemisphereEastIcon, MapPinIcon, NavigationArrowIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import type { AlertSettings } from '../lib/alertRules'
import { currentPosition } from '../lib/position'

/** The radius "Near me" starts with; the settings change it. */
const NEAR_ME_KM = 25

/**
 * Asks where alerts should come from, until the user has chosen: near them,
 * anywhere in Queensland, or places they pick in the settings.
 */
export function AlertAreaPrompt({ settings, onChange, onChoosePlaces }: { settings: AlertSettings; onChange: (s: AlertSettings) => void; onChoosePlaces: () => void }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nearMe = () => {
    setLocating(true)
    setError(null)
    currentPosition().then(
      (at) => (setLocating(false), onChange({ ...settings, nearMe: { at, km: NEAR_ME_KM } })),
      (e: Error) => (setLocating(false), setError(e.message)),
    )
  }

  return (
    <section className="grid gap-2.5 border-b border-kumo-line bg-kumo-recessed px-3 py-3" aria-labelledby="alert-area-title">
      <div className="grid gap-0.5">
        <Text as="h3" bold id="alert-area-title">
          Where should alerts come from?
        </Text>
        <Text size="sm" variant="secondary">
          Until you choose, you'll only hear about events you watch and your Translink routes.
        </Text>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" icon={<NavigationArrowIcon />} loading={locating} onClick={nearMe}>
          Within {NEAR_ME_KM} km of me
        </Button>
        <Button size="sm" variant="secondary" icon={<MapPinIcon />} onClick={onChoosePlaces}>
          Choose places
        </Button>
        <Button size="sm" variant="secondary" icon={<GlobeHemisphereEastIcon />} onClick={() => onChange({ ...settings, everywhere: true })}>
          Anywhere in Queensland
        </Button>
      </div>
      {error && (
        <Text size="sm" variant="error">
          {error}
        </Text>
      )}
    </section>
  )
}
