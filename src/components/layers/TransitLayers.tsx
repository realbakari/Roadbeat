import { Text } from '@cloudflare/kumo'
import { BusIcon } from '@phosphor-icons/react'
import type { VehicleMode } from '../../api/transitTypes'
import { VEHICLE_COLOR } from '../../lib/mapIcons'
import { chipClass } from '../chip'
import { Badge, Group, LayerRow, type LayerGroupProps } from './LayerRow'

const VEHICLE_MODES: { mode: VehicleMode; label: string }[] = [
  { mode: 'train', label: 'Trains' },
  { mode: 'bus', label: 'Buses' },
  { mode: 'tram', label: 'Tram' },
  { mode: 'ferry', label: 'Ferries' },
]

/** TransLink's live vehicles, with a chip per mode. */
export function TransitLayers({
  layers,
  set,
  vehicleModes,
  onVehicleModesChange,
  vehicleCounts,
  vehicleError,
}: Omit<LayerGroupProps, 'counts'> & {
  vehicleModes: VehicleMode[]
  onVehicleModesChange: (modes: VehicleMode[]) => void
  vehicleCounts: Partial<Record<VehicleMode, number>>
  vehicleError: string | null
}) {
  return (
    <Group title="Public transport">
      <LayerRow
        icon={<Badge color={VEHICLE_COLOR.bus} icon={<BusIcon size={12} weight="fill" />} />}
        label="Live vehicles, lines and stops"
        layer="vehicles"
        checked={layers.vehicles}
        onChange={(v) => set('vehicles', v)}
      >
        <div className="flex flex-wrap gap-1" role="group" aria-label="Vehicle types">
          {VEHICLE_MODES.map(({ mode, label }) => {
            const on = vehicleModes.includes(mode)
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={on}
                onClick={() => onVehicleModesChange(on ? vehicleModes.filter((m) => m !== mode) : [...vehicleModes, mode])}
                className={chipClass(on)}
              >
                <span className="size-2 rounded-full" style={{ background: VEHICLE_COLOR[mode], opacity: on ? 1 : 0.4 }} />
                {label}
                {vehicleCounts[mode] != null && <span className="tabular-nums text-kumo-subtle">{vehicleCounts[mode]}</span>}
              </button>
            )
          })}
        </div>
        <Text size="xs" variant={vehicleError ? 'error' : 'secondary'}>
          {vehicleError
            ? `Live positions unavailable: ${vehicleError}.`
            : 'TransLink live positions (SEQ, Cairns and any other region whose feed is live), every 15 s. Zoom in to see them.'}
        </Text>
      </LayerRow>
    </Group>
  )
}
