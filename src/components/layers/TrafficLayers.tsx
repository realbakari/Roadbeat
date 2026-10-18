import { Text } from '@cloudflare/kumo'
import { ArrowsVerticalIcon, ProhibitIcon } from '@phosphor-icons/react'
import { BCC_CLEARANCES_URL, QR_CLEARANCES_URL } from '../../api/clearances'
import { CLEARWAYS_URL } from '../../api/bccPlaces'
import type { SpeedCamera } from '../../api/speedCameras'
import type { Feed } from '../../hooks/useHazardFeeds'
import { iconUrl, LAYER_COLOR, signalIcon } from '../../lib/mapIcons'
import { DS_BANDS } from '../../lib/signals'
import type { MapLayers } from '../map/settings'
import { SpeedCamerasNote } from '../SpeedCameraParts'
import { InlineLink } from '../ui/Links'
import { Badge, Group, LayerRow, type LayerGroupProps } from './LayerRow'
import type { FuelStation } from '../../api/fuelAvailability'
import { FuelNote } from '../FuelParts'
import { byBrand, useFuelBrands } from '../../lib/fuelBrands'

const TOGGLES: { key: keyof MapLayers; label: string; icon: string }[] = [
  { key: 'webcams', label: 'Traffic cameras', icon: 'camera-webcam' },
  { key: 'floodcams', label: 'Flood cameras', icon: 'camera-floodcam' },
  { key: 'waze', label: 'Waze reports', icon: 'waze' },
  { key: 'trucks', label: 'Truck restrictions', icon: 'truck-restriction' },
]

/** Cameras, Waze, truck restrictions, speed cameras, clearances, clearways and signals. */
export function TrafficLayers({
  layers,
  counts,
  set,
  speedCameras,
  fuel,
  clearanceError,
  clearwaysError,
}: LayerGroupProps & { speedCameras: Feed<SpeedCamera[]>; fuel: Feed<FuelStation[]>; clearanceError: string | null; clearwaysError: string | null }) {
  const fuelBrands = useFuelBrands()
  return (
    <Group title="Traffic">
      {TOGGLES.map((t) => (
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
        icon={<img src={iconUrl('speedcam-fixed')} alt="" className="size-5" />}
        label="Speed and red light cameras"
        count={speedCameras.data?.length}
        layer="speedCameras"
        checked={layers.speedCameras}
        onChange={(v) => set('speedCameras', v)}
      >
        <SpeedCamerasNote feed={speedCameras} />
      </LayerRow>
      <LayerRow
        icon={<img src={iconUrl('fuel-available')} alt="" className="size-5" />}
        label="Fuel at service stations"
        count={fuel.data ? byBrand(fuel.data, fuelBrands).length : undefined}
        layer="fuel"
        checked={layers.fuel}
        onChange={(v) => set('fuel', v)}
      >
        <FuelNote feed={fuel} />
      </LayerRow>
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
              <InlineLink href={BCC_CLEARANCES_URL}>Brisbane City Council</InlineLink>{' '}
              and{' '}
              <InlineLink href={QR_CLEARANCES_URL}>Queensland Rail</InlineLink>
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
          <Text size="xs" variant={clearwaysError ? 'error' : 'secondary'}>
            {clearwaysError ? (
              `Clearways unavailable: ${clearwaysError}.`
            ) : (
              <>
                From the signed times in{' '}
                <InlineLink href={CLEARWAYS_URL}>Brisbane City Council's records</InlineLink>
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
  )
}
