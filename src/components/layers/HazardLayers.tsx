import { Text } from '@cloudflare/kumo'
import { ClockCounterClockwiseIcon, CloudRainIcon, DropHalfBottomIcon, FireSimpleIcon, FlameIcon, HouseLineIcon, HurricaneIcon, LightningIcon, NewspaperIcon, PathIcon, WarningIcon, WavesIcon, WindIcon } from '@phosphor-icons/react'
import type { ComponentProps } from 'react'
import { AIR_COLOR, AIR_QUALITY_DATASET, AIR_RATINGS } from '../../api/airQuality'
import { FIRE_COLOR } from '../../api/bushfires'
import type { CrashFilter } from '../../api/crashes'
import type { FireBans } from '../../api/fireBans'
import { HOTSPOT_COLOR } from '../../api/hotspots'
import { CYCLONE_COLOR, type Cyclone } from '../../api/jtwc'
import { NSW_ALERT_COLOR, type NswFire } from '../../api/nswFires'
import { PAST_CYCLONE_COLOR, type PastCyclone } from '../../api/pastCyclones'
import { WARNING_COLOR } from '../../api/qldWarnings'
import type { Feed } from '../../hooks/useHazardFeeds'
import { CENTRE_COLOR } from '../../lib/councilCentres'
import { LAYER_COLOR } from '../../lib/mapIcons'
import { OUTAGE_COLOR } from '../../lib/outages'
import { CyclonesNote, FireBansLine, NswFiresNote, PastCyclonesNote } from '../HazardLayerNotes'
import { HotspotsNote } from '../SatelliteLayerNotes'
import { InlineLink } from '../ui/Links'
import { FiresNote, WarningsNote } from '../WarningLayerNotes'
import { CrashControls } from './CrashControls'
import { Badge, Group, LayerRow, type LayerGroupProps } from './LayerRow'

/** Fires, warnings, weather, news, outages, gauges and crash history. */
export function HazardLayers({
  layers,
  counts,
  set,
  fireState,
  warningState,
  hotspotState,
  hazards,
  airError,
  unplacedOutages,
  gaugeNotice,
  crashFilter,
  onCrashFilterChange,
}: LayerGroupProps & {
  fireState: ComponentProps<typeof FiresNote>
  warningState: ComponentProps<typeof WarningsNote>
  hotspotState: ComponentProps<typeof HotspotsNote>
  hazards: { fireBans: Feed<FireBans>; nswFires: Feed<NswFire[]>; cyclones: Feed<Cyclone[]>; pastCyclones: Feed<PastCyclone[]> }
  airError: string | null
  unplacedOutages: number
  gaugeNotice: string | null
  crashFilter: CrashFilter
  onCrashFilterChange: (filter: CrashFilter) => void
}) {
  return (
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
                <InlineLink href={AIR_QUALITY_DATASET}>state's live feed</InlineLink>{' '}
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
  )
}
