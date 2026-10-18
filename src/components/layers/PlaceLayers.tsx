import { Text } from '@cloudflare/kumo'
import { ACCESSIBLE_PARKING_URL, BIKE_RACKS_URL, PARKING_METERS_URL, TOILETS_URL } from '../../api/bccPlaces'
import { EVENTS_URL } from '../../api/bccDashboard'
import { iconUrl } from '../../lib/mapIcons'
import type { MapLayers } from '../map/settings'
import { InlineLink } from '../ui/Links'
import { Group, LayerRow, type LayerGroupProps } from './LayerRow'

const TOGGLES: { key: keyof MapLayers; label: string; icon: string }[] = [
  { key: 'restAreas', label: 'Rest areas', icon: 'rest-area' },
  { key: 'dumpPoints', label: 'RV dump points', icon: 'dump-point' },
]

/** Rest areas and dump points, and Brisbane City Council's toilets, parking, cycling and events. */
export function PlaceLayers({
  layers,
  counts,
  set,
  councilErrors,
}: LayerGroupProps & { councilErrors: { toilets: string | null; accessibleParking: string | null; parkingMeters: string | null; cycling: string | null; councilEvents: string | null } }) {
  return (
    <Group title="Places">
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
              <InlineLink href={TOILETS_URL}>Brisbane City Council</InlineLink>
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
              <InlineLink href={ACCESSIBLE_PARKING_URL}>Brisbane City Council</InlineLink>
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
              <InlineLink href={PARKING_METERS_URL}>Brisbane City Council</InlineLink>
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
                <InlineLink href={BIKE_RACKS_URL}>open data</InlineLink>
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
              <InlineLink href={EVENTS_URL}>Brisbane City Council</InlineLink>
              . Zoom in to see them.
            </>
          )}
        </Text>
      </LayerRow>
    </Group>
  )
}
