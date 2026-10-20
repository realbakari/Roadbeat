import { Badge, Tooltip } from '@cloudflare/kumo'
import { ArrowSquareOutIcon, BusIcon, CaretRightIcon, CheckIcon, FlameIcon, LinkSimpleIcon, MapTrifoldIcon, ShareNetworkIcon, WarningIcon, type Icon } from '@phosphor-icons/react'
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { FIRE_BADGE, FIRE_COLOR, type FireLevel } from '../api/bushfires'
import { WARNING_BADGE, WARNING_COLOR, type WarningLevel } from '../api/qldWarnings'
import { NewTabNote } from '../components/NewTabNote'
import { PublisherIcon } from '../components/NewsStoryRow'
import { RelativeTime } from '../components/ui/RelativeTime'
import { useCopied } from '../hooks/useCopied'
import { priorityBadge, typeMeta } from '../lib/eventMeta'
import { laneOf, shareText, type Post } from '../lib/posts'
import { timeDetail } from '../lib/relativeTime'
import { timelinePath } from '../lib/route'
import { readableTextOn } from '../lib/routeColor'
import { isInteractive, isPlainClick } from './navigation'

// One post on the timeline, laid out like the social feeds it's modelled on:
// a rail on the left where each publisher has a lane in its own colour, the
// publisher's mark as the node, related posts (same road or area) joined on
// one lane with the later ones as dots, and updates hanging off the lane below.
// Read-only: the actions open the item, share it or copy its link.

/** Updates shown before "earlier updates". */
const THREAD_SHOWN = 2

const ACTION = 'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 transition-colors hover:bg-kumo-tint hover:text-kumo-default pointer-coarse:min-h-9'

const FIRE_LEVELS: string[] = Object.keys(FIRE_COLOR)
const WARNING_LEVELS: string[] = Object.keys(WARNING_COLOR)
const isFireLevel = (s: string | null): s is FireLevel => s != null && FIRE_LEVELS.includes(s)
const isWarningLevel = (s: string | null): s is WarningLevel => s != null && WARNING_LEVELS.includes(s)
const isWebLink = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url)

/** The mark inside the node: the event type's glyph, the fire or warning level's, or Translink's bus. Null for news, which shows the publisher's icon. */
function markOf(post: Post): { color: string; Icon: Icon } | null {
  if (post.source === 'road') return { color: typeMeta(post.mark ?? '').color, Icon: typeMeta(post.mark ?? '').icon }
  if (post.source === 'fire' && isFireLevel(post.mark)) return { color: FIRE_COLOR[post.mark], Icon: FlameIcon }
  if (post.source === 'warning' && isWarningLevel(post.mark)) return { color: WARNING_COLOR[post.mark], Icon: WarningIcon }
  if (post.source === 'transit') return { color: '#475569', Icon: BusIcon }
  return null
}

/** The node: the mark in a ring of the lane's colour, on the card's colour so the lane behind it stays hidden. */
export function RailAvatar({ post }: { post: Post }) {
  const mark = markOf(post)
  return (
    <span className="flex rounded-full bg-kumo-base">
      <span className="flex rounded-full border-2 p-0.5" style={{ borderColor: 'var(--lane)' }}>
        {mark ? (
          <span className="flex size-10 items-center justify-center rounded-full" style={{ backgroundColor: mark.color, color: readableTextOn(mark.color) }}>
            <mark.Icon size={20} weight="fill" />
          </span>
        ) : (
          <PublisherIcon publisher={post.publisher} kind={post.newsKind ?? 'news'} icon={post.icon} size="lg" round />
        )}
      </span>
    </span>
  )
}

/** A small node on the lane: a later related post, an update, or the end of a lane. */
export function RailDot() {
  return (
    <span className="flex rounded-full bg-kumo-base">
      <span className="size-3.5 rounded-full border-[3px] border-kumo-base" style={{ backgroundColor: 'var(--lane)', boxShadow: '0 0 0 2px var(--lane)' }} />
    </span>
  )
}

/** How a rail cell's lane leaves it: on into the next cell, into a dot near the bottom, or not at all. */
export type Tail = 'on' | 'dot' | 'none'

/**
 * The rail cell: the lane above coming in from the top, the node, and the lane
 * going on below it. Nodes sit 2rem down, beside the name.
 */
export function Rail({ lane, incoming, tail, node, nodeTop = '2rem' }: { lane: string; incoming: string | null; tail: Tail; node: ReactNode; nodeTop?: string }) {
  return (
    <div aria-hidden className={`relative ${tail === 'dot' ? 'min-h-24' : 'min-h-16'}`} style={{ '--lane': lane } as CSSProperties}>
      {incoming && <span className="absolute top-0 left-1/2 w-0.5 -translate-x-1/2" style={{ height: `calc(${nodeTop} + 1px)`, background: incoming }} />}
      {tail !== 'none' && (
        <span className={`absolute left-1/2 w-0.5 -translate-x-1/2 ${tail === 'dot' ? 'bottom-5' : 'bottom-0'}`} style={{ top: `calc(${nodeTop} - 1px)`, background: lane }} />
      )}
      {node && (
        <span className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2" style={{ top: nodeTop }}>
          {node}
        </span>
      )}
      {tail === 'dot' && (
        <span className="absolute bottom-5 left-1/2 flex -translate-x-1/2 translate-y-1/2">
          <RailDot />
        </span>
      )}
    </div>
  )
}

/** The publisher's level in its own words, styled as each of the app's lists styles it. */
export function Level({ post }: { post: Post }) {
  if (!post.level) return null
  if (post.source === 'road') {
    const b = priorityBadge(post.level)
    return (
      <Badge variant={b.variant} appearance={b.appearance}>
        {post.level}
      </Badge>
    )
  }
  const cls = post.source === 'fire' && isFireLevel(post.mark) ? FIRE_BADGE[post.mark] : post.source === 'warning' && isWarningLevel(post.mark) ? WARNING_BADGE[post.mark] : ''
  return <span className={`rounded px-1.5 py-px font-sans text-xs font-semibold ${cls}`}>{post.level}</span>
}

/** Shares the post's words and link: the system share sheet where there is one, else both copied. */
export function ShareAction({ post, url }: { post: Post; url: string }) {
  const [copied, flashCopied] = useCopied(2000)
  const text = shareText(post)
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text, url })
        return
      } catch (e) {
        // Closing the sheet isn't an error; any other failure falls back to copying.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      flashCopied()
    } catch {
      // Clipboard can be blocked; the post's link still opens it.
    }
  }
  return (
    <button type="button" onClick={share} className={ACTION} aria-live="polite" aria-keyshortcuts="s" title="Share the official details and a link (s)">
      {copied ? <CheckIcon size={16} aria-hidden /> : <ShareNetworkIcon size={16} aria-hidden />}
      <span className="max-sm:sr-only">{copied ? 'Copied' : 'Share'}</span>
    </button>
  )
}

/** Copies the post's own link. */
export function CopyLink({ url }: { url: string }) {
  const [copied, flashCopied] = useCopied(2000)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      flashCopied()
    } catch {
      // Clipboard can be blocked; the address bar still has the link.
    }
  }
  return (
    <Tooltip
      content={copied ? 'Link copied' : 'Copy link (y)'}
      render={
        <button
          type="button"
          onClick={copy}
          className="rounded-md p-1 transition-colors hover:bg-kumo-tint hover:text-kumo-default pointer-coarse:p-2"
          aria-label={copied ? 'Link copied' : 'Copy link'}
          aria-keyshortcuts="y"
        />
      }
    >
      {copied ? <CheckIcon size={16} aria-hidden /> : <LinkSimpleIcon size={16} aria-hidden />}
    </Tooltip>
  )
}

/** The time a post was filed, as a link to its page; hover or keyboard focus shows the exact Queensland time, and the page itself writes it out. */
function TimeLink({ post, now, onOpen }: { post: Post; now: number; onOpen: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const d = timeDetail(post.at, now)
  if (!d) return <span>Unknown time</span>
  const updated = post.updated != null ? timeDetail(post.updated, now) : null
  return (
    <Tooltip
      content={
        <span className="grid gap-0.5">
          <span>
            {post.stamp} {d.exact}
          </span>
          {updated && <span>Updated {updated.exact}</span>}
        </span>
      }
      render={<a href={timelinePath(post.id)} onClick={onOpen} className="hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-kumo-brand" />}
    >
      <time dateTime={d.iso}>
        <span aria-hidden>{d.label}</span>
        <span className="sr-only">
          {post.stamp} {d.spoken}
        </span>
      </time>
    </Tooltip>
  )
}

interface Props {
  post: Post
  now: number
  /** The related post above's lane, which joins this one at the top; null when the post above isn't related. */
  incoming: string | null
  /** The related post above has the same publisher, so this one is a dot on its lane. */
  grouped: boolean
  /** The related post below continues the lane; otherwise it ends in a dot under this post. */
  continues: boolean
  /** Opens the post's own page in the timeline. */
  onOpen: (post: Post) => void
  /** The post its own page is about: larger text, every update shown, and the card isn't a link. */
  focused?: boolean
  /** On the post's own page, its full details, shown above the actions. */
  children?: ReactNode
}

export function PostCard({ post, now, incoming, grouped, continues, onOpen, focused = false, children }: Props) {
  const [threadOpen, setThreadOpen] = useState(true)
  const [allReplies, setAllReplies] = useState(focused)
  const lane = laneOf(post)
  const n = post.replies.length
  const replies = allReplies ? post.replies : post.replies.slice(-THREAD_SHOWN)
  const hidden = n - replies.length
  const path = timelinePath(post.id)
  const appUrl = `/#${post.href}`
  const showThread = n > 0 && threadOpen
  const text = focused ? 'text-[17px]' : 'text-[15px]'

  // The whole card opens the post, as a feed's posts do. Links, buttons and
  // anything portalled out of the card keep their own clicks, selecting text
  // doesn't navigate, and a modified or middle click opens a new tab.
  const openCard = (e: MouseEvent<HTMLElement>) => {
    if (focused || !(e.target instanceof Element) || !e.currentTarget.contains(e.target) || isInteractive(e.target)) return
    if (window.getSelection()?.toString()) return
    if (isPlainClick(e)) onOpen(post)
    else if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(path, '_blank', 'noopener')
  }
  const openLink = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return
    e.preventDefault()
    onOpen(post)
  }

  return (
    <article
      tabIndex={-1}
      data-post={post.id}
      className={`grid scroll-mt-16 grid-cols-[4rem_minmax(0,1fr)] outline-none transition-colors sm:grid-cols-[4.5rem_minmax(0,1fr)] ${focused ? '' : 'cursor-pointer hover:bg-kumo-tint/50 focus-visible:bg-kumo-tint'}`}
      onClick={openCard}
      onAuxClick={openCard}
    >
      <Rail
        lane={lane}
        incoming={incoming}
        tail={showThread || continues ? 'on' : 'dot'}
        node={
          grouped ? (
            <span className="-translate-y-[9px]">
              <RailDot />
            </span>
          ) : (
            <RailAvatar post={post} />
          )
        }
      />
      <div className={`min-w-0 pr-4 ${showThread ? 'pt-3' : 'border-b border-kumo-line py-3'}`}>
        <div className="flex min-w-0 items-baseline gap-1.5 text-[15px]">
          <span className="max-w-[70%] shrink-0 truncate font-semibold text-kumo-strong">{post.publisher}</span>
          {post.handle && <span className="min-w-0 shrink-[4] truncate font-mono text-[13px] text-kumo-subtle">{post.handle}</span>}
          <span className="text-kumo-subtle" aria-hidden>
            ·
          </span>
          <span className="shrink-0 font-mono text-[13px] text-kumo-subtle">
            <TimeLink post={post} now={now} onOpen={openLink} />
          </span>
          {post.ref && <span className="ml-auto shrink-0 font-mono text-[13px] text-kumo-subtle max-sm:hidden">{post.ref}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs text-kumo-subtle">
          <span>{post.stamp === 'Published' || post.stamp === 'Reported' ? post.kind : `${post.kind} · ${post.stamp.toLowerCase()}`}</span>
          <Level post={post} />
          {post.updated != null && (
            <span>
              updated <RelativeTime at={post.updated} now={now} inline />
            </span>
          )}
        </div>
        <h3 className={`m-0 mt-1 leading-relaxed font-semibold text-kumo-strong ${text}`}>
          {focused ? (
            post.title
          ) : (
            <a href={path} onClick={openLink} className="hover:underline">
              {post.title}
            </a>
          )}
        </h3>
        {post.body && <p className={`m-0 leading-relaxed text-kumo-default ${text} ${focused ? '' : 'line-clamp-4'}`}>{post.body}</p>}
        {post.place && <p className="m-0 mt-0.5 font-mono text-[13px] text-kumo-subtle">{post.place}</p>}
        {children}
        <div className="mt-1 -ml-2 flex items-center justify-between gap-0.5 text-[13px] text-kumo-subtle">
          <div className="flex flex-wrap items-center gap-0.5">
            <a href={appUrl} className={ACTION} aria-keyshortcuts="m" title="On the map (m)" data-action="map">
              <MapTrifoldIcon size={16} aria-hidden />
              <span className="max-sm:sr-only">On the map</span>
            </a>
            <ShareAction post={post} url={`${location.origin}${path}`} />
            {n > 0 && !focused && (
              <button
                type="button"
                aria-expanded={threadOpen}
                aria-keyshortcuts="o"
                onClick={() => setThreadOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-kumo-link transition-colors hover:bg-kumo-tint pointer-coarse:min-h-9"
              >
                <CaretRightIcon size={12} aria-hidden className={`transition-transform ${threadOpen ? 'rotate-90' : ''}`} />
                {n} {post.source === 'news' ? (n === 1 ? 'more report' : 'more reports') : n === 1 ? 'update' : 'updates'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {isWebLink(post.sourceUrl) && (
              <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className={ACTION} title={`${post.publisher}'s page`}>
                <ArrowSquareOutIcon size={16} aria-hidden />
                <span className="max-md:sr-only">{post.publisher}'s page</span>
                <NewTabNote />
              </a>
            )}
            <CopyLink url={`${location.origin}${path}`} />
          </div>
        </div>
      </div>

      {showThread && (
        <>
          {hidden > 0 && (
            <>
              <Rail lane={lane} incoming={lane} tail="on" node={null} />
              <div className="min-w-0 pr-4">
                <button type="button" onClick={() => setAllReplies(true)} className="inline-flex min-h-8 items-center gap-1 font-mono text-[13px] text-kumo-link hover:underline">
                  {hidden} earlier {post.source === 'news' ? (hidden === 1 ? 'report' : 'reports') : hidden === 1 ? 'update' : 'updates'}
                </button>
              </div>
            </>
          )}
          {replies.map((r, i) => {
            const last = i === replies.length - 1
            return (
              <div key={`${r.at}-${r.text}`} className="contents">
                <Rail lane={lane} incoming={lane} tail={!last || continues ? 'on' : 'dot'} node={<RailDot />} nodeTop="1.375rem" />
                <div className={`min-w-0 pt-2.5 pr-4 ${last ? 'border-b border-kumo-line pb-3' : 'pb-1'}`}>
                  <div className="flex min-w-0 items-baseline gap-1.5 text-[15px]">
                    <span className="truncate font-semibold text-kumo-strong">{r.by ?? post.publisher}</span>
                    <span className="text-kumo-subtle" aria-hidden>
                      ·
                    </span>
                    <span className="shrink-0 font-mono text-[13px] text-kumo-subtle">
                      {post.source === 'news' ? 'reported' : 'updated'} <RelativeTime at={r.at} now={now} inline />
                    </span>
                  </div>
                  <p className="m-0 mt-0.5 text-[15px] leading-relaxed">{r.text}</p>
                </div>
              </div>
            )
          })}
        </>
      )}
    </article>
  )
}
