import { Button, ButtonGroup } from '@cloudflare/kumo'
import { GlobeHemisphereEastIcon, MapTrifoldIcon } from '@phosphor-icons/react'
import type { MapBase } from '../../lib/mapBase'

/** The one-tap Map / Satellite switch on the map. Satellite shows the image chosen in the layers panel (live Himawari-9 by default). */
export function BaseSwitch({ base, onChange }: { base: MapBase; onChange: (b: MapBase) => void }) {
  return (
    <ButtonGroup aria-label="Map base" className="shadow-md">
      <Button size="sm" variant={base === 'map' ? 'primary' : 'secondary'} aria-pressed={base === 'map'} icon={<MapTrifoldIcon />} onClick={() => onChange('map')}>
        Map
      </Button>
      <Button
        size="sm"
        variant={base === 'satellite' ? 'primary' : 'secondary'}
        aria-pressed={base === 'satellite'}
        icon={<GlobeHemisphereEastIcon />}
        onClick={() => onChange('satellite')}
      >
        Satellite
      </Button>
    </ButtonGroup>
  )
}
