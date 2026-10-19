import { Banner, InputGroup, Loader, Select, Text } from '@cloudflare/kumo'
import { FunnelSimpleIcon, InfoIcon, MagnifyingGlassIcon, MapPinIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { NewsSnapshot } from '../api/newsTypes'
import { filterStories, storyRegions, DEFAULT_STORY_FILTER, type NewsStory, type StoryFilter } from '../lib/newsStories'
import { StoryRow } from './NewsStoryRow'
import { chipClass } from './chip'
import { RelativeTime } from './ui/RelativeTime'
import { LoadFailed, NoResults } from './ui/StateMessage'

interface Props {
  snapshot: NewsSnapshot | null
  error: string | null
  stories: NewsStory[]
  filter: StoryFilter
  onFilterChange: (f: StoryFilter) => void
  now: number
  onOpen: (id: string) => void
}

const KINDS: { value: StoryFilter['kind']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'official', label: 'Official' },
  { value: 'news', label: 'News reports' },
]

/**
 * The News tab: Queensland headlines from news outlets and official sources in
 * the last 48 hours, newest first, with reports of one story grouped together.
 */
export function NewsPanel({ snapshot, error, stories, filter, onFilterChange, now, onOpen }: Props) {
  const regions = useMemo(() => storyRegions(stories), [stories])
  const outlets = useMemo(() => [...new Set(stories.flatMap((s) => s.publishers))].sort(), [stories])
  const shown = useMemo(() => filterStories(stories, filter, now), [stories, filter, now])
  const failed = snapshot?.sources.filter((s) => !s.ok) ?? []
  const set = <K extends keyof StoryFilter>(k: K, v: StoryFilter[K]) => onFilterChange({ ...filter, [k]: v })
  const filtered = filter.kind !== 'all' || filter.region !== 'all' || filter.outlet !== 'all' || filter.hours !== 48 || !!filter.query || !!filter.place || filter.live
  // On phones the three dropdowns fold behind a Filters button; from tablet width up they always show.
  const [moreOpen, setMoreOpen] = useState(false)
  const dropdownsSet = [filter.hours !== 48, filter.region !== 'all', filter.outlet !== 'all'].filter(Boolean).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-2 border-b border-kumo-line px-4 pt-3 pb-3">
        <InputGroup>
          <InputGroup.Addon>
            <MagnifyingGlassIcon />
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Search news" placeholder="Search headlines and places" value={filter.query} onChange={(e) => set('query', e.target.value)} />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Source type">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={filter.kind === k.value}
              onClick={() => set('kind', k.value)}
              className={chipClass(filter.kind === k.value)}
            >
              {k.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={filter.live}
            onClick={() => set('live', !filter.live)}
            className={chipClass(filter.live)}
          >
            Live blogs
          </button>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="news-more-filters"
            onClick={() => setMoreOpen((v) => !v)}
            className={chipClass(moreOpen || !!dropdownsSet, 'ml-auto md:hidden')}
          >
            <FunnelSimpleIcon size={14} aria-hidden /> Filters{dropdownsSet ? ` (${dropdownsSet})` : ''}
          </button>
        </div>
        <div id="news-more-filters" className={`${moreOpen ? 'grid' : 'hidden'} grid-cols-3 gap-2 md:grid`}>
          <Select
            aria-label="Time window"
            size="sm"
            className="w-full"
            value={String(filter.hours)}
            onValueChange={(v) => set('hours', v === '6' ? 6 : v === '24' ? 24 : 48)}
            items={{ '6': 'Last 6 hours', '24': 'Last 24 hours', '48': 'Last 48 hours' }}
          />
          <Select
            aria-label="Council area"
            size="sm"
            className="w-full"
            value={filter.region}
            onValueChange={(v) => set('region', (v as string) ?? 'all')}
            items={{
              all: 'All areas',
              unlocated: 'No council area',
              ...Object.fromEntries(regions.map((r) => [r.lga, `${r.lga} (${r.count})`])),
            }}
          />
          <Select
            aria-label="Outlet"
            size="sm"
            className="w-full"
            value={filter.outlet}
            onValueChange={(v) => set('outlet', (v as string) ?? 'all')}
            items={{ all: 'All sources', ...Object.fromEntries(outlets.map((o) => [o, o])) }}
          />
        </div>
        {filter.place && (
          <button
            type="button"
            onClick={() => set('place', null)}
            className="inline-flex w-fit items-center gap-1.5 rounded-md bg-kumo-tint py-1 pr-2 pl-2.5 text-sm text-kumo-strong ring ring-kumo-brand hover:bg-kumo-recessed"
            title="Show stories from everywhere"
          >
            <MapPinIcon size={14} aria-hidden /> Naming {filter.place}
            <XIcon size={12} aria-label="Clear" aria-hidden={false} role="img" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-kumo-line px-4 py-2">
        <Text variant="secondary" size="sm">
          <span className="tabular-nums">{shown.length}</span> {shown.length === 1 ? 'story' : 'stories'}
          {snapshot && <> · feeds read <RelativeTime at={snapshot.fetchedAt} now={now} /></>}
        </Text>
        {filtered && (
          <button type="button" className="text-sm text-kumo-link hover:underline" onClick={() => onFilterChange(DEFAULT_STORY_FILTER)}>
            Clear filters
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {(error || failed.length > 0) && (
          <div className="px-4 pt-3">
            <Banner
              variant="alert"
              size="sm"
              icon={<WarningCircleIcon weight="fill" />}
              description={
                error
                  ? `Couldn't load the news monitor: ${error}.${snapshot ? ' Showing the last reports received.' : ''}`
                  : `Not responding on the last read: ${failed.map((f) => f.publisher).join(', ')}. Their earlier reports are still listed.`
              }
            />
          </div>
        )}
        {!snapshot && !error ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : !snapshot && error ? (
          <LoadFailed what="news" source="The news and notice feeds" cause={error} retriesItself />
        ) : shown.length === 0 && filtered ? (
          <NoResults what="stories" query={filter.query} onClear={() => onFilterChange(DEFAULT_STORY_FILTER)} hint="Search by headline or place, or widen the time and source filters." />
        ) : shown.length === 0 ? (
          <div className="px-4 py-4">
            <p className="m-0 font-semibold">No reports in the last 48 hours</p>
            <Text variant="secondary">None of the news and notice feeds Roadbeat reads has a Queensland report in that time.</Text>
          </div>
        ) : (
          <ul className="divide-y divide-kumo-line">
            {shown.map((s) => (
              <li key={s.id}>
                <StoryRow story={s} now={now} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-4">
          <Banner
            variant="secondary"
            size="sm"
            icon={<InfoIcon weight="fill" />}
            description="Headlines and links only, from each publisher's feed. Reports aren't verified: Roadbeat groups headlines that share most of their words and pins a story only where it names a place in Queensland's official place names gazetteer. Open a report to read it at its source."
          />
        </div>
      </div>
    </div>
  )
}
