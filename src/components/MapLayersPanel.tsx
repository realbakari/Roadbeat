import { Button, Select, Switch, Text } from '@cloudflare/kumo'
import { ArrowsVerticalIcon, DropHalfBottomIcon, ProhibitIcon, BuildingsIcon, BusIcon, FlameIcon, WavesIcon, ClockCounterClockwiseIcon, CloudRainIcon, HouseLineIcon, LightningIcon, WindIcon, NewspaperIcon, StackIcon, XIcon, FireSimpleIcon, WarningIcon, HurricaneIcon, PathIcon } from '@phosphor-icons/react'
import { FIRE_COLOR } from '../api/bushfires'
import { WARNING_COLOR } from '../api/qldWarnings'
import { DS_BANDS } from '../lib/signals'
import type { VehicleMode } from '../api/translink'
import { createContext, useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import {
  CRASH_DATA_END,
  CRASH_DATASET_URL,
  CRASH_FIRST_YEAR,
  CRASH_LAST_YEAR,
  SEVERITIES,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  type CrashFilter,
} from '../api/crashes'
import { EVENT_TYPES } from '../lib/eventMeta'
import { BCC_CLEARANCES_URL, QR_CLEARANCES_URL } from '../api/clearances'
import { ACCESSIBLE_PARKING_URL, BIKE_RACKS_URL, CLEARWAYS_URL, PARKING_METERS_URL, TOILETS_URL } from '../api/bccPlaces'
import { EVENTS_URL } from '../api/bccDashboard'
import { iconUrl, LAYER_COLOR, signalIcon, typeSlug, VEHICLE_COLOR } from '../lib/mapIcons'
import { CENTRE_COLOR } from '../lib/councilCentres'
import { OUTAGE_COLOR } from '../lib/outages'
import { AIR_COLOR, AIR_QUALITY_DATASET, AIR_RATINGS } from '../api/airQuality'
import type { Basemap, MapLayers } from './map/settings'
import { NewTabNote } from './NewTabNote'
import { HOTSPOT_COLOR } from '../api/hotspots'
import { HotspotsNote } from './SatelliteLayerNotes'
import { SatelliteImageNote } from './SatelliteImageNote'
import { FiresNote, WarningsNote } from './WarningLayerNotes'
import { CyclonesNote, FireBansLine, NswFiresNote, PastCyclonesNote } from './HazardLayerNotes'
import type { Feed } from '../hooks/useHazardFeeds'
import type { FireBans } from '../api/fireBans'
import type { NswFire } from '../api/nswFires'
import { CYCLONE_COLOR, type Cyclone } from '../api/jtwc'
import { NSW_ALERT_COLOR } from '../api/nswFires'
import { PAST_CYCLONE_COLOR, type PastCyclone } from '../api/pastCyclones'
import { chipClass } from './chip'
import { LayerInfoLine } from './LayerFacts'
import { layerInfo, type DataTime } from '../lib/layerInfo'

/** Each layer's latest data time, and the clock to age it by, for the rows' info lines. */
const LayerTimes = createContext<{ latest: Partial<Record<keyof MapLayers, DataTime>>; now: number }>({ latest: {}, now: 0 })
import { BaseSwitch } from './map/BaseSwitch'
import { MapKey } from './map/MapKey'
import type { MapBase } from '../lib/mapBase'

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
  hazards: { fireBans: Feed<FireBans>; nswFires: Feed<NswFire[]>; cyclones: Feed<Cyclone[]>; pastCyclones: Feed<PastCyclone[]> }
  /** Load errors for the council's clearway, toilet, parking, cycling and events layers. */
  councilErrors: { clearways: string | null; toilets: string | null; accessibleParking: string | null; parkingMeters: string | null; cycling: string | null; councilEvents: string | null }
}

const VEHICLE_MODES: { mode: VehicleMode; label: string }[] = [
  { mode: 'train', label: 'Trains' },
  { mode: 'bus', label: 'Buses' },
  { mode: 'tram', label: 'Tram' },
  { mode: 'ferry', label: 'Ferries' },
]

const BASEMAPS: { value: Basemap; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Light or dark, with the app' },
  { value: 'detailed', label: 'Detailed', hint: 'Streets and landmarks' },
  { value: 'bright', label: 'Bright', hint: 'Colourful' },
  { value: 'night', label: 'Night', hint: 'Dark blue' },
]

const TOGGLES: { key: keyof MapLayers; label: string; icon: string; group: 'traffic' | 'places' }[] = [
  { key: 'webcams', label: 'Traffic cameras', icon: 'camera-webcam', group: 'traffic' },
  { key: 'floodcams', label: 'Flood cameras', icon: 'camera-floodcam', group: 'traffic' },
  { key: 'waze', label: 'Waze reports', icon: 'waze', group: 'traffic' },
  { key: 'trucks', label: 'Truck restrictions', icon: 'truck-restriction', group: 'traffic' },
  { key: 'restAreas', label: 'Rest areas', icon: 'rest-area', group: 'places' },
  { key: 'dumpPoints', label: 'RV dump points', icon: 'dump-point', group: 'places' },
]

/** A titled block of layer switches. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-0.5 border-t border-kumo-line pt-3">
      <Text size="xs" variant="secondary">
        {title}
      </Text>
      {children}
    </section>
  )
}

/** One layer's switch, with its key or settings underneath while it's on. */
function LayerRow({
  icon,
  label,
  count,
  checked,
  onChange,
  layer,
  children,
}: {
  icon: ReactNode
  label: string
  count?: number
  checked: boolean
  onChange: (on: boolean) => void
  /** The layer's key, for its publisher, cadence and latest time (src/lib/layerInfo.ts). */
  layer?: keyof MapLayers
  children?: ReactNode
}) {
  const times = useContext(LayerTimes)
  const info = layer ? layerInfo(layer) : null
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 rounded-md py-1 text-sm">
        {icon}
        <span className="flex-1">
          {label}
          {count != null && <span className="ml-1 text-kumo-subtle tabular-nums">{count}</span>}
        </span>
        <Switch size="sm" aria-label={label} checked={checked} onCheckedChange={onChange} />
      </label>
      {checked && (children || info) && (
        <div className="grid gap-1.5 pb-1.5 pl-7">
          {info && <LayerInfoLine info={info} latest={layer && times.latest[layer]} now={times.now} />}
          {children}
        </div>
      )}
    </>
  )
}

/** A small coloured disc holding a layer's icon. */
function Badge({ icon, color, className = '' }: { icon: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-white ${className}`}
      style={color ? { background: color } : undefined}
    >
      {icon}
    </span>
  )
}

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
      className="absolute top-3 left-3 z-20 flex max-h-[calc(100%-5rem)] w-64 flex-col overflow-hidden rounded-xl bg-kumo-base shadow-md ring ring-kumo-line"
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
        <Group title="Hazards and weather">
          <LayerRow
            icon={<Badge color={FIRE_COLOR['Watch and Act']} icon={<FlameIcon size={12} weight="fill" />} />}
            label="Bushfires"
            count={counts.fires}
            layer="fires"
            checked={layers.fires}
            onChange={(v) => set('fires', v)}
          >
            <FiresNote {...fireState} />
            <FireBansLine feed={hazards.fireBans} />
          </LayerRow>
          <LayerRow
            icon={<Badge color={WARNING_COLOR['Watch and Act']} icon={<WarningIcon size={12} weight="fill" />} />}
            label="Storm, flood and cyclone warnings"
            count={counts.warnings}
            layer="warnings"
            checked={layers.warnings}
            onChange={(v) => set('warnings', v)}
          >
            <WarningsNote {...warningState} />
          </LayerRow>
          <LayerRow
            icon={<Badge color={HOTSPOT_COLOR} icon={<FireSimpleIcon size={12} weight="fill" />} />}
            label="Satellite hotspots"
            count={counts.hotspots}
            layer="hotspots"
            checked={layers.hotspots}
            onChange={(v) => set('hotspots', v)}
          >
            <HotspotsNote {...hotspotState} />
          </LayerRow>
          <LayerRow
            icon={<Badge color={NSW_ALERT_COLOR.Advice} icon={<FlameIcon size={12} weight="fill" />} />}
            label="NSW fires near the border"
            count={hazards.nswFires.data?.length}
            layer="nswFires"
            checked={layers.nswFires}
            onChange={(v) => set('nswFires', v)}
          >
            <NswFiresNote feed={hazards.nswFires} />
          </LayerRow>
          <LayerRow
            icon={<Badge color={CYCLONE_COLOR} icon={<HurricaneIcon size={12} weight="fill" />} />}
            label="Tropical cyclones (JTWC)"
            count={hazards.cyclones.data?.length}
            layer="cyclones"
            checked={layers.cyclones}
            onChange={(v) => set('cyclones', v)}
          >
            <CyclonesNote feed={hazards.cyclones} />
          </LayerRow>
          <LayerRow
            icon={<Badge color={PAST_CYCLONE_COLOR} icon={<PathIcon size={12} weight="bold" />} />}
            label="Past cyclone tracks"
            count={hazards.pastCyclones.data?.length}
            layer="pastCyclones"
            checked={layers.pastCyclones}
            onChange={(v) => set('pastCyclones', v)}
          >
            <PastCyclonesNote feed={hazards.pastCyclones} />
          </LayerRow>
          <LayerRow
            icon={<Badge color={LAYER_COLOR.news} icon={<NewspaperIcon size={12} weight="fill" />} />}
            label="News and official notices"
            count={counts.news}
            layer="news"
            checked={layers.news}
            onChange={(v) => set('news', v)}
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${LAYER_COLOR.news}` }} /> News report
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: LAYER_COLOR.newsOfficial }} /> Police, BoM or earthquake
                </span>
              </div>
              <Text size="xs" variant="secondary">
                Pinned only where a headline or summary names a Queensland place in the official gazetteer. Reports aren't verified.
              </Text>
            </div>
          </LayerRow>
          <LayerRow
            icon={<Badge color={AIR_COLOR[2]} icon={<WindIcon size={12} weight="fill" />} />}
            label="Air quality"
            count={counts.airQuality}
            layer="airQuality"
            checked={layers.airQuality}
            onChange={(v) => set('airQuality', v)}
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                {AIR_RATINGS.map((name, i) => (
                  <span key={name} className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: AIR_COLOR[(i + 1) as 1 | 2 | 3 | 4 | 5] }} />
                    {name}
                  </span>
                ))}
              </div>
              <Text size="xs" variant={airError ? 'error' : 'secondary'}>
                {airError ? (
                  `Air quality unavailable: ${airError}.`
                ) : (
                  <>
                    Each station's worst-rated value this hour, with the ratings the{' '}
                    <a href={AIR_QUALITY_DATASET} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                      state's live feed
                      <NewTabNote />
                    </a>{' '}
                    gives. The feed updates hourly; most values are running averages over longer periods.
                  </>
                )}
              </Text>
            </div>
          </LayerRow>
          <LayerRow
            icon={<Badge color={OUTAGE_COLOR.energex} icon={<LightningIcon size={12} weight="fill" />} />}
            label="Outages and council notices"
            count={counts.outages}
            layer="outages"
            checked={layers.outages}
            onChange={(v) => set('outages', v)}
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full" style={{ background: OUTAGE_COLOR.energex }} /> Energex power outage, placed at its suburb
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full" style={{ background: OUTAGE_COLOR.council }} /> Council notice, at the shape the council drew
                </span>
              </div>
              <Text size="xs" variant="secondary">
                As relayed by council disaster dashboards. Energex names a suburb and streets, not a point; Ergon's area has no feed.
              </Text>
              {unplacedOutages > 0 && (
                <Text size="xs" variant="secondary">
                  {unplacedOutages === 1 ? '1 Energex outage is' : `${unplacedOutages} Energex outages are`} not on the map: the place names gazetteer has no suburb by that name in
                  the council area Energex gives. The dashboard's outages list includes them.
                </Text>
              )}
            </div>
          </LayerRow>
          <LayerRow
            icon={<Badge color={CENTRE_COLOR.shelter} icon={<HouseLineIcon size={12} weight="fill" />} />}
            label="Council centres"
            count={counts.councilCentres}
            layer="councilCentres"
            checked={layers.councilCentres}
            onChange={(v) => set('councilCentres', v)}
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                {(
                  [
                    [CENTRE_COLOR.shelter, 'Evacuation or refuge'],
                    [CENTRE_COLOR.sandbag, 'Sandbags'],
                    [CENTRE_COLOR.other, 'Other'],
                  ] as const
                ).map(([c, l]) => (
                  <span key={l} className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: c }} />
                    {l}
                  </span>
                ))}
              </div>
              <Text size="xs" variant="secondary">
                Centres councils list on their disaster dashboards, with the status each council gives. Opened as needed, so often few or none.
              </Text>
            </div>
          </LayerRow>
          <LayerRow
            icon={<Badge className="bg-sky-700" icon={<WavesIcon size={12} weight="fill" />} />}
            label="Stream and rain gauges"
            count={counts.gauges}
            layer="gauges"
            checked={layers.gauges}
            onChange={(v) => set('gauges', v)}
          >
            <Text size="xs" variant={gaugeNotice ? 'error' : 'secondary'}>
              {gaugeNotice ??
                'Brisbane City Council and Queensland Government gauges. Blue: stream height (m). Teal: rain in the last hour. Faded: no reading in the last hour.'}
            </Text>
          </LayerRow>
          <LayerRow
            icon={<Badge color={LAYER_COLOR.flood2022} icon={<DropHalfBottomIcon size={12} weight="fill" />} />}
            label="February 2022 flood extent"
            layer="flood2022"
            checked={layers.flood2022}
            onChange={(v) => set('flood2022', v)}
          >
            <Text size="xs" variant="secondary">
              Where the Brisbane River and creeks flooded in February 2022, as adopted by Brisbane City Council. A past flood for context, not a
              forecast or a current warning. Outlines simplified to about 5 m.
            </Text>
          </LayerRow>
          <LayerRow
            icon={<Badge className="bg-sky-600" icon={<CloudRainIcon size={12} weight="fill" />} />}
            label="Rain radar"
            layer="radar"
            checked={layers.radar}
            onChange={(v) => set('radar', v)}
          >
            <Text size="xs" variant="secondary">
              Radar © Bureau of Meteorology via QLDTraffic
            </Text>
          </LayerRow>
          <LayerRow
            icon={<Badge className="bg-red-700" icon={<ClockCounterClockwiseIcon size={12} weight="bold" />} />}
            label="Crash history"
            layer="crashes"
            checked={layers.crashes}
            onChange={(v) => set('crashes', v)}
          >
            <CrashControls filter={crashFilter} onChange={onCrashFilterChange} />
          </LayerRow>
        </Group>

        <Group title="Traffic">
          {TOGGLES.filter((t) => t.group === 'traffic').map((t) => (
            <LayerRow
              key={t.key}
              icon={<img src={iconUrl(t.icon)} alt="" className="size-5" />}
              label={t.label}
              count={counts[t.key]}
              layer={t.key}
              checked={layers[t.key]}
              onChange={(v) => set(t.key, v)}
            />
          ))}
          <LayerRow
            icon={<Badge color={LAYER_COLOR.clearance} className="ring ring-black/70" icon={<ArrowsVerticalIcon size={12} weight="bold" color="#111" />} />}
            label="Low clearances"
            count={counts.clearances}
            layer="clearances"
            checked={layers.clearances}
            onChange={(v) => set('clearances', v)}
          >
            <Text size="xs" variant={clearanceError ? 'error' : 'secondary'}>
              {clearanceError
                ? `Clearances unavailable: ${clearanceError}.`
                : 'Signed clearances of low bridges and structures, as published by '}
              {!clearanceError && (
                <>
                  <a href={BCC_CLEARANCES_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                    Brisbane City Council
                    <NewTabNote />
                  </a>{' '}
                  and{' '}
                  <a href={QR_CLEARANCES_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                    Queensland Rail
                    <NewTabNote />
                  </a>
                  . Not every low structure is listed; always obey the signs on the road.
                </>
              )}
            </Text>
          </LayerRow>
          <LayerRow
            icon={<Badge color={LAYER_COLOR.clearwayOn} icon={<ProhibitIcon size={12} weight="bold" />} />}
            label="Clearways"
            count={counts.clearways}
            layer="clearways"
            checked={layers.clearways}
            onChange={(v) => set('clearways', v)}
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-4 rounded-full" style={{ background: LAYER_COLOR.clearwayOn }} /> In effect now
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: LAYER_COLOR.clearwayOff }} /> Not now, or times unknown
                </span>
              </div>
              <Text size="xs" variant={councilErrors.clearways ? 'error' : 'secondary'}>
                {councilErrors.clearways ? (
                  `Clearways unavailable: ${councilErrors.clearways}.`
                ) : (
                  <>
                    From the signed times in{' '}
                    <a href={CLEARWAYS_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                      Brisbane City Council's records
                      <NewTabNote />
                    </a>
                    . Zoom in to see them. The signs on the road are what count.
                  </>
                )}
              </Text>
            </div>
          </LayerRow>
          <LayerRow
            icon={<img src={iconUrl(signalIcon(1))} alt="" className="size-5" />}
            label="Signal traffic"
            count={counts.signals}
            layer="signals"
            checked={layers.signals}
            onChange={(v) => set('signals', v)}
          >
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
              {DS_BANDS.map(([from], band) => (
                <span key={from} className="inline-flex items-center gap-1">
                  <img src={iconUrl(signalIcon(band))} alt="" className="size-4" />
                  {from}%+
                </span>
              ))}
            </div>
            <Text size="xs" variant="secondary">
              Busiest lane's measured degree of saturation at Brisbane City Council signals. The council publishes new readings about every
              5 minutes; a ring marks signals that changed, and a red halo marks signals at 100% or more.
            </Text>
          </LayerRow>
        </Group>

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

        <Group title="Places">
          {TOGGLES.filter((t) => t.group === 'places').map((t) => (
            <LayerRow
              key={t.key}
              icon={<img src={iconUrl(t.icon)} alt="" className="size-5" />}
              label={t.label}
              count={counts[t.key]}
              layer={t.key}
              checked={layers[t.key]}
              onChange={(v) => set(t.key, v)}
            />
          ))}
          <LayerRow
            icon={<img src={iconUrl('toilet-accessible')} alt="" className="size-5" />}
            label="Public toilets"
            count={counts.toilets}
            layer="toilets"
            checked={layers.toilets}
            onChange={(v) => set('toilets', v)}
          >
            <Text size="xs" variant={councilErrors.toilets ? 'error' : 'secondary'}>
              {councilErrors.toilets ? (
                `Toilets unavailable: ${councilErrors.toilets}.`
              ) : (
                <>
                  Blue: accessible toilet. Grey: no accessible toilet listed. Brisbane only, from the National Public Toilet Map via{' '}
                  <a href={TOILETS_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                    Brisbane City Council
                    <NewTabNote />
                  </a>
                  .
                </>
              )}
            </Text>
          </LayerRow>
          <LayerRow
            icon={<img src={iconUrl('accessible-parking')} alt="" className="size-5" />}
            label="Accessible parking"
            count={counts.accessibleParking}
            layer="accessibleParking"
            checked={layers.accessibleParking}
            onChange={(v) => set('accessibleParking', v)}
          >
            <Text size="xs" variant={councilErrors.accessibleParking ? 'error' : 'secondary'}>
              {councilErrors.accessibleParking ? (
                `Accessible parking unavailable: ${councilErrors.accessibleParking}.`
              ) : (
                <>
                  Disability permit bays on council streets, with their signed times, from{' '}
                  <a href={ACCESSIBLE_PARKING_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                    Brisbane City Council
                    <NewTabNote />
                  </a>
                  . Zoom in to see them.
                </>
              )}
            </Text>
          </LayerRow>
          <LayerRow
            icon={<img src={iconUrl('parking-meter')} alt="" className="size-5" />}
            label="Parking meters"
            count={counts.parkingMeters}
            layer="parkingMeters"
            checked={layers.parkingMeters}
            onChange={(v) => set('parkingMeters', v)}
          >
            <Text size="xs" variant={councilErrors.parkingMeters ? 'error' : 'secondary'}>
              {councilErrors.parkingMeters ? (
                `Parking meters unavailable: ${councilErrors.parkingMeters}.`
              ) : (
                <>
                  Hours, maximum stay and hourly rates as the council lists them, from{' '}
                  <a href={PARKING_METERS_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                    Brisbane City Council
                    <NewTabNote />
                  </a>
                  . Zoom in to see them.
                </>
              )}
            </Text>
          </LayerRow>
          <LayerRow
            icon={<img src={iconUrl('bike-rack')} alt="" className="size-5" />}
            label="Bikeways and bike racks"
            count={counts.cycling}
            layer="cycling"
            checked={layers.cycling}
            onChange={(v) => set('cycling', v)}
          >
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
                {(
                  [
                    ['#15803d', 'Separated path'],
                    ['#22c55e', 'Shared path'],
                    ['#65a30d', 'Bike lane'],
                    ['#84cc16', 'Bike route'],
                  ] as const
                ).map(([c, l]) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-4 rounded-full" style={{ background: c }} /> {l}
                  </span>
                ))}
              </div>
              <Text size="xs" variant={councilErrors.cycling ? 'error' : 'secondary'}>
                {councilErrors.cycling ? (
                  `Bike racks unavailable: ${councilErrors.cycling}.`
                ) : (
                  <>
                    Brisbane City Council's bikeway network, bike racks and repair stations (
                    <a href={BIKE_RACKS_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                      open data
                      <NewTabNote />
                    </a>
                    ). Zoom in to see them.
                  </>
                )}
              </Text>
            </div>
          </LayerRow>
          <LayerRow
            icon={<img src={iconUrl('council-event')} alt="" className="size-5" />}
            label="Council events"
            count={counts.councilEvents}
            layer="councilEvents"
            checked={layers.councilEvents}
            onChange={(v) => set('councilEvents', v)}
          >
            <Text size="xs" variant={councilErrors.councilEvents ? 'error' : 'secondary'}>
              {councilErrors.councilEvents ? (
                `Council events unavailable: ${councilErrors.councilEvents}.`
              ) : (
                <>
                  Events on today and in the next 7 days with a published location, as listed by{' '}
                  <a href={EVENTS_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
                    Brisbane City Council
                    <NewTabNote />
                  </a>
                  . Zoom in to see them.
                </>
              )}
            </Text>
          </LayerRow>
        </Group>
      </div>
    </div>
    </LayerTimes.Provider>
  )
}

const YEARS = Object.fromEntries(
  Array.from({ length: CRASH_LAST_YEAR - CRASH_FIRST_YEAR + 1 }, (_, i) => {
    const y = String(CRASH_LAST_YEAR - i)
    return [y, y]
  }),
)

function CrashControls({ filter, onChange }: { filter: CrashFilter; onChange: (f: CrashFilter) => void }) {
  const setYear = (key: 'from' | 'to', v: string | null) => {
    const y = Number(v)
    if (!y) return
    const next = { ...filter, [key]: y }
    if (next.from > next.to) next[key === 'from' ? 'to' : 'from'] = y
    onChange(next)
  }
  const toggle = (s: CrashFilter['severities'][number]) => {
    const has = filter.severities.includes(s)
    if (has && filter.severities.length === 1) return
    onChange({ ...filter, severities: has ? filter.severities.filter((x) => x !== s) : [...filter.severities, s] })
  }

  return (
    <div className="grid gap-2 rounded-lg bg-kumo-recessed p-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <Select aria-label="From year" size="sm" className="w-full" value={String(filter.from)} onValueChange={(v) => setYear('from', v as string)} items={YEARS} />
        <Text size="xs" variant="secondary">
          to
        </Text>
        <Select aria-label="To year" size="sm" className="w-full" value={String(filter.to)} onValueChange={(v) => setYear('to', v as string)} items={YEARS} />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Crash severity">
        {SEVERITIES.map((s) => {
          const on = filter.severities.includes(s)
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={chipClass(on)}
            >
              <span className="size-2 rounded-full" style={{ background: SEVERITY_COLOR[s], opacity: on ? 1 : 0.4 }} />
              {SEVERITY_LABEL[s]}
            </button>
          )
        })}
      </div>
      <Text size="xs" variant="secondary">
        Property-damage-only crashes were recorded until 2010. Data to {CRASH_DATA_END}.{' '}
        <a href={CRASH_DATASET_URL} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
          TMR, CC BY 4.0
          <NewTabNote />
        </a>
      </Text>
    </div>
  )
}
