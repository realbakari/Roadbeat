import { Button, Switch, Text } from '@cloudflare/kumo'
import { BuildingsIcon, StackIcon, XIcon } from '@phosphor-icons/react'
import type { VehicleMode } from '../api/transitTypes'
import { useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { CrashFilter } from '../api/crashes'
import { EVENT_TYPES } from '../lib/eventMeta'
import { iconUrl, typeSlug } from '../lib/mapIcons'
import type { Basemap, MapLayers } from './map/settings'
import type { HotspotsNote } from './SatelliteLayerNotes'
import { SatelliteImageNote } from './SatelliteImageNote'
import type { FiresNote, WarningsNote } from './WarningLayerNotes'
import type { Feed } from '../hooks/useHazardFeeds'
import type { FireBans } from '../api/fireBans'
import type { NswFire } from '../api/nswFires'
import type { NswHazard } from '../api/nswHazards'
import type { Cyclone } from '../api/jtwc'
import type { PastCyclone } from '../api/pastCyclones'
import type { SpeedCamera } from '../api/speedCameras'
import type { DataTime } from '../lib/layerInfo'
import { BaseSwitch } from './map/BaseSwitch'
import { MapKey } from './map/MapKey'
import type { MapBase } from '../lib/mapBase'
import { LayerTimes } from './layers/layerTimes'
import { HazardLayers } from './layers/HazardLayers'
import { TrafficLayers } from './layers/TrafficLayers'
import { TransitLayers } from './layers/TransitLayers'
import { PlaceLayers } from './layers/PlaceLayers'
import type { FuelStation } from '../api/fuelStations'

interface Props {
  basemap: Basemap
  onBasemapChange: (b: Basemap) => void
  layers: MapLayers
  counts: Partial<Record<keyof MapLayers, number>>
  onChange: (layers: MapLayers) => void
  crashFilter: CrashFilter
  onCrashFilterChange: (filter: CrashFilter) => void
  vehicleModes: VehicleMode[]
  onVehicleModesChange: (modes: VehicleMode[]) => void
  vehicleCounts: Partial<Record<VehicleMode, number>>
  vehicleError: string | null
  clearanceError: string | null
  airError: string | null
  /** Energex outages kept off the map because their suburb isn't in the gazetteer. */
  unplacedOutages: number
  /** The bushfire and Queensland warnings feeds' state, for their notes. */
  fireState: ComponentProps<typeof FiresNote>
  warningState: ComponentProps<typeof WarningsNote>
  /** Why gauges are missing or stale, or null while their feeds are fine. */
  gaugeNotice: string | null
  /** The hotspot feed's state, for its note. */
  hotspotState: ComponentProps<typeof HotspotsNote>
  /** The map's base, and the one-tap switch between the street map and a satellite image. */
  base: MapBase
  onBaseChange: (b: MapBase) => void
  /** Each layer's latest data time (src/lib/layerInfo.ts) and the clock to age it by, for the info lines. */
  times: { latest: Partial<Record<keyof MapLayers, DataTime>>; now: number }
  /** Shown under the Layers and base buttons while the panel is closed, such as a prompt to show the satellite view. */
  aside?: ReactNode
  /** Which satellite image is chosen, and the state of each source. */
  imagery: ComponentProps<typeof SatelliteImageNote>
  /** Fire bans, NSW border fires, JTWC cyclones and past cyclone tracks, for their notes. */
  hazards: { fireBans: Feed<FireBans>; nswFires: Feed<NswFire[]>; nswHazards: Feed<NswHazard[]>; cyclones: Feed<Cyclone[]>; pastCyclones: Feed<PastCyclone[]>; speedCameras: Feed<SpeedCamera[]>; fuel: Feed<FuelStation[]> }
  /** Load errors for the council's clearway, toilet, parking, cycling and events layers. */
  councilErrors: { clearways: string | null; toilets: string | null; accessibleParking: string | null; parkingMeters: string | null; cycling: string | null; councilEvents: string | null }
}

const BASEMAPS: { value: Basemap; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Light or dark, with the app' },
  { value: 'detailed', label: 'Detailed', hint: 'Streets and landmarks' },
  { value: 'bright', label: 'Bright', hint: 'Colourful' },
  { value: 'night', label: 'Night', hint: 'Dark blue' },
]

/** Layer switches and icon key for the map, collapsed to a button on small screens. */
export function MapLayersPanel({
  layers,
  counts,
  onChange,
  crashFilter,
  onCrashFilterChange,
  vehicleModes,
  onVehicleModesChange,
  vehicleCounts,
  vehicleError,
  clearanceError,
  airError,
  unplacedOutages,
  fireState,
  warningState,
  gaugeNotice,
  hotspotState,
  imagery,
  base,
  onBaseChange,
  aside,
  times,
  hazards,
  councilErrors,
  basemap,
  onBasemapChange,
}: Props) {
  const [open, setOpenState] = useState(false)
  // The button and the panel are separate trees, so focus moves to whichever one replaces the other.
  const toggled = useRef(false)
  const setOpen = (v: boolean) => {
    toggled.current = true
    setOpenState(v)
  }
  const takeFocus = (el: HTMLButtonElement | null) => {
    if (!el || !toggled.current) return
    toggled.current = false
    el.focus()
  }
  const set = (key: keyof MapLayers, v: boolean) => onChange({ ...layers, [key]: v })

  if (!open) {
    return (
      <div className="absolute top-3 left-3 z-10 grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button ref={takeFocus} size="sm" icon={<StackIcon />} onClick={() => setOpen(true)} className="shadow-md">
            Layers
          </Button>
          <BaseSwitch base={base} onChange={onBaseChange} />
          <MapKey layers={layers} />
        </div>
        {aside}
      </div>
    )
  }

  // Above the map's popups and camera thumbnails, which carry their own z-index.
  return (
    <LayerTimes.Provider value={times}>
    <div
      className="absolute top-3 left-3 z-20 flex max-h-[calc(100%-5rem)] w-64 flex-col max-sm:right-3 max-sm:w-auto overflow-hidden rounded-xl bg-kumo-base shadow-md ring ring-kumo-line"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        setOpen(false)
      }}
    >
      <div className="flex items-center justify-between border-b border-kumo-line py-1.5 pr-1.5 pl-3">
        <Text bold size="sm">
          Map layers
        </Text>
        <Button ref={takeFocus} size="sm" variant="ghost" shape="square" aria-label="Hide layers" icon={<XIcon />} onClick={() => setOpen(false)} className="max-md:size-11" />
      </div>
      <div className="grid gap-3 overflow-y-auto px-3 py-3">
        <div className="grid gap-1.5">
          <Text size="xs" variant="secondary">
            Map style
          </Text>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Map style">
            {BASEMAPS.map((b) => (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={basemap === b.value}
                onClick={() => onBasemapChange(b.value)}
                className={`grid rounded-lg px-2.5 py-1.5 text-left ring ${basemap === b.value ? 'bg-kumo-tint ring-kumo-brand' : 'ring-kumo-line hover:bg-kumo-tint'}`}
              >
                <span className="text-sm">{b.label}</span>
                <span className="text-xs text-kumo-subtle">{b.hint}</span>
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md py-1 text-sm">
            <span className="flex size-5 items-center justify-center rounded-full bg-kumo-contrast text-kumo-inverse">
              <BuildingsIcon size={12} weight="fill" />
            </span>
            <span className="flex-1">3D buildings</span>
            <Switch size="sm" aria-label="3D buildings" checked={layers.buildings3d} onCheckedChange={(v: boolean) => set('buildings3d', v)} />
          </label>
          {layers.buildings3d && (
            <Text size="xs" variant="secondary">
              {layers.radar
                ? 'The map stays flat while rain radar is on, so the radar lines up.'
                : 'Building heights from OpenStreetMap. Zoom in to street level to see them.'}
            </Text>
          )}
        </div>
        <div className="grid gap-1.5 border-t border-kumo-line pt-3">
          <Text size="xs" variant="secondary">
            Base
          </Text>
          <BaseSwitch base={base} onChange={onBaseChange} />
          {base === 'satellite' ? (
            <SatelliteImageNote {...imagery} />
          ) : (
            <Text size="xs" variant="secondary">
              Satellite shows one image under the labels and layers: Himawari-9 live by default, or a daily pass.
            </Text>
          )}
        </div>
        <div className="grid gap-1.5 border-t border-kumo-line pt-3">
          <Text size="xs" variant="secondary">
            Road events
          </Text>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
            {EVENT_TYPES.map((m) => (
              <li key={m.type} className="flex items-center gap-1.5 text-xs">
                <img src={iconUrl(`event-${typeSlug(m.type)}`)} alt="" className="size-5" />
                {m.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-xs">
              <img src={iconUrl('closure-all')} alt="" className="size-5" />
              Road closed
            </li>
            <li className="flex items-center gap-1.5 text-xs">
              <img src={iconUrl('event-roadworks-future')} alt="" className="size-5" />
              Upcoming
            </li>
          </ul>
        </div>
        <HazardLayers
          layers={layers}
          counts={counts}
          set={set}
          fireState={fireState}
          warningState={warningState}
          hotspotState={hotspotState}
          hazards={hazards}
          airError={airError}
          unplacedOutages={unplacedOutages}
          gaugeNotice={gaugeNotice}
          crashFilter={crashFilter}
          onCrashFilterChange={onCrashFilterChange}
        />

        <TrafficLayers layers={layers} counts={counts} set={set} speedCameras={hazards.speedCameras} fuel={hazards.fuel} clearanceError={clearanceError} clearwaysError={councilErrors.clearways} />

        <TransitLayers
          layers={layers}
          set={set}
          vehicleModes={vehicleModes}
          onVehicleModesChange={onVehicleModesChange}
          vehicleCounts={vehicleCounts}
          vehicleError={vehicleError}
        />

        <PlaceLayers layers={layers} counts={counts} set={set} councilErrors={councilErrors} />
      </div>
    </div>
    </LayerTimes.Provider>
  )
}
