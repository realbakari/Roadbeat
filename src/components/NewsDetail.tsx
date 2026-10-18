import { Banner, Button, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, ArrowSquareOutIcon, CaretRightIcon, InfoIcon, MapPinIcon } from '@phosphor-icons/react'
import { useMemo, type ReactNode } from 'react'
import type { FireWarning } from '../api/bushfires'
import type { NewsPlace, NewsRoad } from '../api/newsTypes'
import type { TrafficEvent } from '../api/types'
import { eventTitle } from '../lib/eventText'
import { officialNow } from '../lib/newsOfficial'
import { lastDate } from '../lib/newsItems'
import { reportedAgo, storySourceLine, type NewsStory } from '../lib/newsStories'
import { LiveBlogBadge, PublisherIcon, StoryMark } from './NewsStoryRow'
import { NewTabNote } from './NewTabNote'
import { brisbaneDayDateTime as when } from '../lib/aest'

/**
 * One story: each report's headline, publisher, time and first sentence, linked
 * to the original, and where the story was placed on the map and why.
 */
export function NewsDetail({
  story,
  now,
  onBack,
  onShowPlace,
  onShowRoad,
  events,
  fires,
  onOpenHref,
}: {
  story: NewsStory
  now: number
  onBack: () => void
  onShowPlace: (p: NewsPlace) => void
  onShowRoad: (r: NewsRoad) => void
  /** Current QLDTraffic events and QFD warnings, for "Official reports there now". */
  events: TrafficEvent[]
  fires: FireWarning[] | null
  onOpenHref: (href: string) => void
}) {
  const official = useMemo(() => officialNow(story, events, fires ?? [], now), [story, events, fires, now])
  const officialCount = official.events.length + official.fires.length
  const isOfficial = story.kind === 'official'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          All news
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-5 px-4 pt-4 pb-8">
          <header className="flex items-start gap-3">
            <StoryMark story={story} size="lg" />
            <div className="grid min-w-0 gap-1">
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-kumo-subtle">
                {story.live && <LiveBlogBadge />}
                {storySourceLine(story)}
              </span>
              <Text as="h2" variant="heading" size="lg">
                {story.items[0].title}
              </Text>
            </div>
          </header>

          <section className="grid gap-2">
            <Text as="h3" variant="heading">
              {isOfficial ? 'Notice' : story.items.length === 1 ? 'Report' : `${story.items.length} reports from ${story.publishers.length} ${story.publishers.length === 1 ? 'outlet' : 'outlets'}`}
            </Text>
            <ul className="grid gap-2">
              {story.items.map((it) => (
                <li key={it.id} className="grid gap-1.5 rounded-lg px-3 py-2.5 ring ring-kumo-line">
                  <span className="flex items-center gap-2 text-xs text-kumo-subtle">
                    <PublisherIcon publisher={it.publisher} kind={it.kind} icon={it.icon} size="sm" />
                    <span className="font-medium text-kumo-default">{it.publisher}</span>
                    <span className="ml-auto tabular-nums" title={`Published ${when.format(it.published)}${it.updated != null ? `, updated ${when.format(it.updated)}` : ''}`}>
                      {reportedAgo(it.updated != null, lastDate(it), now)}
                    </span>
                  </span>
                  {story.items.length > 1 && <span className="text-sm leading-snug font-medium text-kumo-strong">{it.title}</span>}
                  {it.summary && <span className="text-sm leading-snug text-kumo-default">{it.summary}</span>}
                  <a href={it.link} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-sm text-kumo-link underline decoration-1 underline-offset-2">
                    Read at {it.publisher} <ArrowSquareOutIcon size={13} aria-hidden />
                    <NewTabNote />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-2">
            <Text as="h3" variant="heading">
              On the map
            </Text>
            {story.places.length ? (
              <ul className="grid gap-1.5">
                {story.roads.map((r) => (
                  <li key={`${r.name}|${r.locality}`} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      Located from: <span className="font-medium">{r.name}</span>, {r.locality}
                      <span className="block text-xs text-kumo-subtle">Drawn from Queensland's roads dataset: every segment of that road in {r.locality}</span>
                    </span>
                    <Button size="xs" variant="ghost" icon={<MapPinIcon />} onClick={() => onShowRoad(r)}>
                      Show
                    </Button>
                  </li>
                ))}
                {story.places.filter((p) => !story.roads.some((r) => r.locality === p.name)).map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {p.via === 'source' ? (
                        <>Location from {story.publishers[0]}: {p.name}</>
                      ) : (
                        <>
                          Located from: <span className="font-medium">{p.name}</span>
                          {p.lga && <span className="text-kumo-subtle"> · {p.lga}</span>}
                        </>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {p.via === 'gazetteer' && (
                        <Button size="xs" variant="ghost" onClick={() => onOpenHref(`place/locality/${encodeURIComponent(p.name)}`)} title={`Everything Roadbeat has at ${p.name}`}>
                          More at {p.name}
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" icon={<MapPinIcon />} onClick={() => onShowPlace(p)}>
                        Show
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Text size="sm" variant="secondary">
                Not on the map: no headline or summary here names a place in Queensland's place names gazetteer.
              </Text>
            )}
          </section>

          {officialCount > 0 && (
            <section className="grid gap-2">
              <div className="grid gap-0.5">
                <Text as="h3" variant="heading">
                  Official reports there now
                </Text>
                <Text size="sm" variant="secondary">
                  Reported by QLDTraffic and the Queensland Fire Department at the places this story names. They may not be the incident it describes.
                </Text>
              </div>
              <ul className="grid gap-1">
                {official.events.map((e) => (
                  <OfficialRow key={`e${e.properties.id}`} onClick={() => onOpenHref(`event/${e.properties.id}`)}>
                    {e.properties.event_type} · {eventTitle(e)}
                    {e.properties.road_summary?.locality && <span className="text-kumo-subtle"> · {e.properties.road_summary.locality}</span>}
                  </OfficialRow>
                ))}
                {official.fires.map((f) => (
                  <OfficialRow key={`f${f.id}`} onClick={() => onOpenHref(`fire/${encodeURIComponent(f.id)}`)}>
                    {f.levelText} · {f.area ?? f.title}
                  </OfficialRow>
                ))}
              </ul>
            </section>
          )}

          <Banner
            variant="secondary"
            size="sm"
            icon={<InfoIcon weight="fill" />}
            description={
              isOfficial
                ? `Published by ${story.publishers[0]}. Open it at the source for the full notice and any updates.`
                : "A news report, not verified by Roadbeat. Reports are grouped when their headlines share most of their words within 12 hours, and placed where a headline or summary names a gazetteer place. A place named in a story isn't always where it happened."
            }
          />
        </div>
      </div>
    </div>
  )
}

function OfficialRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ring ring-kumo-line hover:bg-kumo-tint">
        <span className="min-w-0">{children}</span>
        <CaretRightIcon size={14} className="shrink-0 text-kumo-subtle" aria-hidden />
      </button>
    </li>
  )
}
