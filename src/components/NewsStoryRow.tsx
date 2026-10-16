import { BuildingsIcon, CloudLightningIcon, MapPinIcon, NewspaperIcon, SirenIcon, WaveformIcon, type Icon } from '@phosphor-icons/react'
import { useState } from 'react'
import { PUBLISHER_ICONS } from '../api/newsSources'
import type { NewsItem } from '../api/newsTypes'
import { LAYER_COLOR } from '../lib/mapIcons'
import { reportedAgo, storyLocatedLine, storyPlaceNames, storySourceLine, type NewsStory } from '../lib/newsStories'

const FALLBACK_ICON: Record<string, Icon> = {
  'Queensland Police': SirenIcon,
  'Bureau of Meteorology': CloudLightningIcon,
  'Geoscience Australia': WaveformIcon,
}

const SIZES = { sm: { box: 'size-5 rounded', px: 12 }, md: { box: 'size-8 rounded-md', px: 18 }, lg: { box: 'size-10 rounded-lg', px: 22 } } as const

/**
 * A publisher's own site icon, framed by kind as on the map: a purple ring for
 * a news outlet, a dark ring for an official source. Falls back to a generic
 * mark when the publisher has no icon or it fails to load.
 */
export function PublisherIcon({ publisher, kind, size = 'md' }: { publisher: string; kind: NewsItem['kind']; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false)
  const { box, px } = SIZES[size]
  const color = kind === 'official' ? LAYER_COLOR.newsOfficial : LAYER_COLOR.news
  const src = PUBLISHER_ICONS[publisher]
  // Councils have no entry, so an official source without one gets a building.
  const Fallback = FALLBACK_ICON[publisher] ?? (kind === 'official' ? BuildingsIcon : NewspaperIcon)
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center overflow-hidden bg-kumo-base`}
      style={{ boxShadow: `0 0 0 2px ${color}`, color }}
      title={publisher}
    >
      {src && !failed ? (
        <img src={src} alt={publisher} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Fallback size={px} weight={kind === 'official' ? 'fill' : 'regular'} aria-label={publisher} />
      )}
    </span>
  )
}

/** A story's publishers' icons, overlapped when several outlets carried it (up to three). */
export function StoryMark({ story, size = 'md' }: { story: NewsStory; size?: 'md' | 'lg' }) {
  const shown = story.publishers.slice(0, 3)
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((p, i) => (
        <span key={p} className={i ? (size === 'lg' ? '-ml-4' : '-ml-3') : ''} style={{ zIndex: shown.length - i }}>
          <PublisherIcon publisher={p} kind={story.kind} size={size} />
        </span>
      ))}
    </span>
  )
}

/** The publisher's "Live blog" label, kept visually apart from Roadbeat's own text. */
export function LiveBlogBadge() {
  return <span className="rounded bg-kumo-danger/10 px-1.5 py-px text-xs font-semibold text-kumo-danger">Live blog</span>
}

/** A story in the News list. */
export function StoryRow({ story, now, onOpen }: { story: NewsStory; now: number; onOpen: (id: string) => void }) {
  const lead = story.items[0]
  const outlets = story.publishers.length
  const located = storyPlaceNames(story) ?? storyLocatedLine(story)
  return (
    <button
      type="button"
      onClick={() => onOpen(story.id)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-kumo-tint focus-visible:bg-kumo-tint focus-visible:outline-none"
    >
      <span className="pt-0.5">
        <StoryMark story={story} />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex items-baseline justify-between gap-2 text-xs text-kumo-subtle">
          <span className="truncate font-medium">{storySourceLine(story)}</span>
          <span className="shrink-0 tabular-nums">{reportedAgo(lead.updated != null, story.latest, now)}</span>
        </span>
        <span className="text-sm leading-snug font-medium text-kumo-strong">{lead.title}</span>
        {lead.summary && <span className="line-clamp-2 text-sm leading-snug text-kumo-subtle">{lead.summary}</span>}
        {(story.live || outlets > 1 || located) && (
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-xs text-kumo-subtle">
            {story.live && <LiveBlogBadge />}
            {outlets > 1 && <span className="font-medium text-kumo-default">{outlets} outlets</span>}
            {located && (
              <span className="flex min-w-0 items-start gap-1">
                <MapPinIcon size={12} className="mt-px shrink-0" aria-hidden />
                <span className="min-w-0">{located}</span>
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  )
}
