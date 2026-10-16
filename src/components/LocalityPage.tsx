import { Banner, Button, Loader, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, CaretRightIcon, FlameIcon, HouseLineIcon, InfoIcon, LightningIcon, MapPinIcon, MapTrifoldIcon, PackageIcon, WindIcon, type Icon } from '@phosphor-icons/react'
import { useMemo, type ReactNode } from 'react'
import { AIR_COLOR, worstRating, AIR_RATINGS } from '../api/airQuality'
import { FIRE_COLOR, fireKindLabel } from '../api/bushfires'
import { CENTRE_COLOR, centreKind } from '../lib/councilCentres'
import { timeAgo } from '../lib/format'
import { latestReading } from '../lib/gauges'
import type { LngLat } from '../lib/geo'
import { atLocality, NEAR_KM, reportCount, type Locality, type LocalityReport, type LocalitySource, type LocalitySources } from '../lib/locality'
import { outageFacts, OUTAGE_COLOR } from '../lib/outages'
import type { MapLayers } from './map/settings'
import { CameraThumb } from './CameraGrid'
import { EventCard } from './EventCard'
import { StoryRow } from './NewsStoryRow'

/** The map layer that shows each source a locality page lists, as the Layers panel names it. */
const LAYER: Record<LocalitySource, { key: keyof MapLayers; label: string }> = {
  fires: { key: 'fires', label: 'Bushfire warnings' },
  airStations: { key: 'airQuality', label: 'Air quality' },
  centres: { key: 'councilCentres', label: 'Council centres' },
  outages: { key: 'outages', label: 'Outages and council notices' },
  stories: { key: 'news', label: 'News and official notices' },
  gauges: { key: 'gauges', label: 'Stream and rain gauges' },
}

const CENTRE_ICON: Record<ReturnType<typeof centreKind>, Icon> = { shelter: HouseLineIcon, sandbag: PackageIcon, other: MapPinIcon }

interface Props {
  /** The name in the link, shown while the gazetteer loads. */
  name: string
  locality: Locality | null
  loading: boolean
  sources: LocalitySources
  now: number
  onBack: () => void
  onOpenHref: (href: string) => void
  onOpenCamera: (key: string) => void
  /** Flies the map to the locality with the layers its sources are drawn on turned on. */
  onShowOnMap: (center: LngLat, layers: (keyof MapLayers)[]) => void
  onTurnOnLayer: (key: keyof MapLayers) => void
}

/**
 * Everything official Roadbeat has for one gazetteer locality right now, one
 * section per source, each row opening the item's own page. Matching is by the
 * source's published name or position only (see atLocality).
 */
export function LocalityPage(p: Props) {
  const { locality, now } = p
  const report = useMemo(() => (locality ? atLocality(locality, p.sources, now) : null), [locality, p.sources, now])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={p.onBack}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.loading ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : !locality || !report ? (
          <div className="grid gap-3 px-4 pt-4 pb-8">
            <Text as="h2" variant="heading" size="lg">
              {p.name}
            </Text>
            <Text size="sm" variant="secondary">
              No town, suburb or locality with this name is in Queensland's place names gazetteer, so Roadbeat has no page for it.
            </Text>
          </div>
        ) : (
          <Body {...p} locality={locality} report={report} />
        )}
      </div>
    </div>
  )
}

function Body({ locality, report, now, onOpenHref, onOpenCamera, onShowOnMap, onTurnOnLayer }: Props & { locality: Locality; report: LocalityReport }) {
  const counts = [
    [report.events.length, 'road event', 'road events'],
    [report.fires.length, 'bushfire', 'bushfires'],
    [report.cameras.length, 'camera', 'cameras'],
    [report.airStations.length, 'air quality station', 'air quality stations'],
    [report.centres.length, 'council centre', 'council centres'],
    [report.outages.length, 'outage', 'outages'],
    [report.stories.length, 'story', 'stories'],
    [report.gauges.length, 'gauge', 'gauges'],
  ] as const
  const countLine = counts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
  const layers: (keyof MapLayers)[] = [
    ...(report.cameras.some((c) => c.item.kind === 'webcam') ? ['webcams' as const] : []),
    ...(report.cameras.some((c) => c.item.kind === 'floodcam') ? ['floodcams' as const] : []),
    ...(report.fires.length ? ['fires' as const] : []),
    ...(report.airStations.length ? ['airQuality' as const] : []),
    ...(report.centres.length ? ['councilCentres' as const] : []),
    ...(report.outages.length ? ['outages' as const] : []),
    ...(report.stories.length ? ['news' as const] : []),
    ...(report.gauges.length ? ['gauges' as const] : []),
  ]
  return (
    <div className="grid gap-5 px-4 pt-4 pb-8">
      <header className="grid gap-1">
        <Text as="h2" variant="heading" size="lg">
          {locality.name}
        </Text>
        <Text size="sm" variant="secondary">
          {locality.council} · Queensland place names gazetteer
        </Text>
        <Text size="sm">{countLine.length ? countLine.join(' · ') : 'Nothing published here right now in the loaded sources.'}</Text>
        <div className="pt-1">
          <Button size="sm" icon={<MapTrifoldIcon />} onClick={() => onShowOnMap(locality.position, layers)}>
            On the map
          </Button>
        </div>
      </header>

      {report.events.length > 0 && (
        <Section title="Road events" note="QLDTraffic events in effect that it files under this locality.">
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.events.map((e) => (
              <li key={e.properties.id}>
                <EventCard event={e} now={now} headingAs="h4" onSelect={(id) => onOpenHref(`event/${id}`)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.fires.length > 0 && (
        <Section title="Bushfires" note="Queensland Fire Department warnings and incidents whose area, title or location names it.">
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.fires.map((f) => (
              <Row key={f.id} onClick={() => onOpenHref(`fire/${encodeURIComponent(f.id)}`)} icon={FlameIcon} color={FIRE_COLOR[f.level]}>
                <span className="truncate text-sm">{f.area ?? f.title}</span>
                <span className="text-xs text-kumo-subtle">
                  {f.level === 'Information' ? fireKindLabel(f) : f.levelText}
                  {f.status && ` · ${f.status}`}
                  {f.issued && ` · ${timeAgo(f.issued, now)}`}
                </span>
              </Row>
            ))}
          </ul>
        </Section>
      )}

      {report.cameras.length > 0 && (
        <Section title="Cameras" note={`Filed under ${locality.name} by QLDTraffic or a council, or within ${NEAR_KM} km of its gazetteer point.`}>
          <div className="grid grid-cols-2 gap-2">
            {report.cameras.map(({ item: c, km }) => (
              <CameraThumb key={`${c.council ?? ''}${c.kind}${c.properties.id}`} camera={c} note={`${km.toFixed(1)} km`} onOpen={onOpenCamera} />
            ))}
          </div>
        </Section>
      )}

      {report.airStations.length > 0 && (
        <Section title="Air quality" note={`The department's monitoring stations within ${NEAR_KM} km.`}>
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.airStations.map(({ item: s, km }) => {
              const worst = worstRating(s)
              return (
                <Row key={s.id} onClick={() => onOpenHref(`place/air/${encodeURIComponent(s.id)}`)} icon={WindIcon} color={AIR_COLOR[worst ?? 0]}>
                  <span className="truncate text-sm">{s.name}</span>
                  <span className="text-xs text-kumo-subtle">
                    {worst ? AIR_RATINGS[worst - 1] : 'No rated reading'} · {km.toFixed(1)} km · {timeAgo(s.measuredAt, now)}
                  </span>
                </Row>
              )
            })}
          </ul>
        </Section>
      )}

      {report.centres.length > 0 && (
        <Section title="Council centres" note={`Centres councils list on their disaster dashboards within ${NEAR_KM} km.`}>
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.centres.map(({ item: c, km }) => {
              const kind = centreKind(c.type)
              return (
                <Row key={c.id} onClick={() => onOpenHref(`place/centre/${encodeURIComponent(c.id)}`)} icon={CENTRE_ICON[kind]} color={CENTRE_COLOR[kind]}>
                  <span className="truncate text-sm">{c.name}</span>
                  <span className="text-xs text-kumo-subtle">
                    {c.type}
                    {c.status && ` · ${c.status}`} · {km.toFixed(1)} km
                  </span>
                </Row>
              )
            })}
          </ul>
        </Section>
      )}

      {report.outages.length > 0 && (
        <Section title="Power outages" note={`Energex outages whose suburb is ${locality.name}, as a council dashboard relays them.`}>
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.outages.map((o) => (
              <Row key={o.id} onClick={() => onOpenHref(`place/outage/${encodeURIComponent(o.id)}`)} icon={LightningIcon} color={OUTAGE_COLOR[o.source]}>
                <span className="truncate text-sm">{o.title}</span>
                <span className="truncate text-xs text-kumo-subtle">{outageFacts(o).join(' · ')}</span>
              </Row>
            ))}
          </ul>
        </Section>
      )}

      {report.stories.length > 0 && (
        <Section title="News" note={`Stories whose headline or summary names ${locality.name}. A place named in a story isn't always where it happened.`}>
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.stories.map((s) => (
              <li key={s.id}>
                <StoryRow story={s} now={now} onOpen={(id) => onOpenHref(`news/${encodeURIComponent(id)}`)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.gauges.length > 0 && (
        <Section title="Gauges" note={`Brisbane City Council and Queensland Government gauges within ${NEAR_KM} km. Heights are gauge readings, not flood levels.`}>
          <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
            {report.gauges.map(({ item: g, km }) => {
              const latest = latestReading(g)
              return (
                <Row key={g.id} onClick={() => onOpenHref(`gauge/${encodeURIComponent(g.id)}`)}>
                  <span className="truncate text-sm">{g.name}</span>
                  <span className="text-xs text-kumo-subtle">
                    {g.kind === 'stream' ? 'Stream height' : 'Rainfall'} · {km.toFixed(1)} km
                    {latest && ` · ${latest.value} ${g.unit} · ${timeAgo(latest.time, now)}`}
                  </span>
                </Row>
              )
            })}
          </ul>
        </Section>
      )}

      {(report.notLoaded.length > 0 || report.failed.length > 0) && (
        <Section title="Not included">
          <ul className="grid gap-1.5">
            {report.failed.map(({ source, error }) => (
              <li key={source} className="text-sm text-kumo-danger">
                {LAYER[source].label} couldn't be loaded, so none are listed here ({error.replace(/\.$/, '')}).
              </li>
            ))}
            {report.notLoaded.map((k) => (
              <li key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-kumo-subtle">Turn on the {LAYER[k].label} layer to include it.</span>
                <Button size="xs" variant="ghost" onClick={() => onTurnOnLayer(LAYER[k].key)}>
                  Turn on
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
        description={`${reportCount(report) ? 'Each item is listed' : 'Items are listed'} here only because its publisher named ${locality.name} or gave a position within ${NEAR_KM} km of the gazetteer's point for it. Roadbeat infers no locations, so a report filed under a neighbouring suburb is on that suburb's page instead.`}
      />
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <div className="grid gap-0.5">
        <Text as="h3" variant="heading">
          {title}
        </Text>
        {note && (
          <Text size="sm" variant="secondary">
            {note}
          </Text>
        )}
      </div>
      {children}
    </section>
  )
}

function Row({ onClick, icon: I, color, children }: { onClick: () => void; icon?: Icon; color?: string; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-kumo-tint">
        {I && color && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }} aria-hidden>
            <I size={11} weight="fill" />
          </span>
        )}
        <span className="grid min-w-0 flex-1 gap-0.5">{children}</span>
        <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" aria-hidden />
      </button>
    </li>
  )
}
