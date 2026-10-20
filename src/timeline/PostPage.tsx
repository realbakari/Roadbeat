import { ArrowLeftIcon } from '@phosphor-icons/react'
import { NewTabNote } from '../components/NewTabNote'
import { PublisherIcon } from '../components/NewsStoryRow'
import { PublishedText } from '../components/PublishedText'
import { Facts } from '../components/ui/Facts'
import { RelativeTime } from '../components/ui/RelativeTime'
import { brisbaneDayDateTime } from '../lib/aest'
import { laneOf, relatedPosts, type Post } from '../lib/posts'
import { timelinePath } from '../lib/route'
import { isPlainClick } from './navigation'
import { CopyLink, PostCard } from './PostCard'
import { FeedSkeleton } from './FeedParts'

// One post's own page, as a social feed opens a post: the post on the rail in
// full (every field the publisher filled in, word for word, and every update),
// then the other posts on the same road or area, joined on the same lane.

const stamp = (t: number) => `${brisbaneDayDateTime.format(t)} AEST`
const isWebLink = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url)

function Heading({ children }: { children: string }) {
  return <h2 className="m-0 font-mono text-xs font-medium tracking-wide text-kumo-subtle uppercase">{children}</h2>
}

/** Everything the publisher filled in beyond the card: its text under its own headings, a news story's reports, and the published facts. */
function Details({ post, now }: { post: Post; now: number }) {
  const { sections, reports, facts } = post.detail
  return (
    <div className="mt-3 grid gap-4">
      <p className="m-0 font-mono text-[13px] text-kumo-subtle">
        {post.stamp} {stamp(post.at)}
        {post.updated != null && <> · updated {stamp(post.updated)}</>}
      </p>
      {sections.map((s) => (
        <section key={s.title} className="grid gap-1.5">
          <Heading>{s.title}</Heading>
          <div className="text-[15px] leading-relaxed [&_*]:text-[15px]">
            <PublishedText text={s.text} />
          </div>
        </section>
      ))}
      {/* One report is the post itself; the list is for a story several outlets carried. */}
      {reports.length > 1 && (
        <section className="grid gap-2">
          <Heading>{`${reports.length} reports`}</Heading>
          <ul className="m-0 grid list-none gap-3 p-0">
            {reports.map((r) => (
              <li key={r.link} className="flex gap-3">
                <PublisherIcon publisher={r.publisher} kind={post.newsKind ?? 'news'} size="sm" />
                <div className="grid min-w-0 gap-0.5">
                  <span className="text-sm">
                    <span className="font-semibold text-kumo-strong">{r.publisher}</span>
                    <span className="font-mono text-[13px] text-kumo-subtle">
                      {' '}
                      · <RelativeTime at={r.at} now={now} />
                    </span>
                  </span>
                  {isWebLink(r.link) ? (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[15px] font-medium text-kumo-strong underline decoration-1 underline-offset-2">
                      {r.title}
                      <NewTabNote />
                    </a>
                  ) : (
                    <span className="text-[15px] font-medium text-kumo-strong">{r.title}</span>
                  )}
                  {r.summary && <p className="m-0 text-[15px] leading-relaxed">{r.summary}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {facts.length > 0 && (
        <section className="grid gap-2">
          <Heading>Details</Heading>
          <Facts rows={facts} labelWidth="wide" />
        </section>
      )}
    </div>
  )
}

interface Props {
  /** The post, or null when it isn't in the loaded feeds. */
  post: Post | null
  /** Every loaded post, for the related ones. */
  posts: Post[]
  /** The post's source hasn't loaded yet, so "not found" can't be said yet. */
  loading: boolean
  /** Why the post's source failed, if it did. */
  error: string | null
  now: number
  onBack: () => void
  onOpen: (post: Post) => void
}

export function PostPage({ post, posts, loading, error, now, onBack, onOpen }: Props) {
  const header = (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-kumo-line bg-kumo-base px-4">
      <a
        href={timelinePath(null)}
        onClick={(e) => {
          if (!isPlainClick(e)) return
          e.preventDefault()
          onBack()
        }}
        className="-ml-1.5 inline-flex rounded-md p-1.5 text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default"
        aria-label="Back to the timeline"
        aria-keyshortcuts="Escape"
      >
        <ArrowLeftIcon size={16} aria-hidden />
      </a>
      <h1 className="m-0 text-base font-semibold text-kumo-strong">Post</h1>
      {post && (
        <span className="ml-auto flex items-center gap-1 text-kumo-subtle">
          {post.ref && <span className="font-mono text-[13px]">{post.ref}</span>}
          <CopyLink url={`${location.origin}${timelinePath(post.id)}`} />
        </span>
      )}
    </div>
  )

  if (!post) {
    return (
      <>
        {header}
        {loading ? (
          <FeedSkeleton rows={1} label="Loading the post" />
        ) : (
          <div className="grid justify-items-center gap-2 px-6 py-16 text-center sm:px-12">
            <p className="m-0 font-mono text-[13px] text-kumo-subtle">{error ? "Couldn't load this post's source" : 'No longer listed'}</p>
            <p className="m-0 max-w-sm text-[15px] text-kumo-default">
              {error
                ? `${error}. It may still be there; try again in a moment.`
                : 'Its publisher no longer lists it in the feed Roadbeat reads, which usually means it has ended or been withdrawn.'}
            </p>
          </div>
        )}
      </>
    )
  }

  const related = relatedPosts(posts, post)
  return (
    <>
      {header}
      <PostCard post={post} now={now} incoming={null} grouped={false} continues={related.length > 0} onOpen={onOpen} focused>
        <Details post={post} now={now} />
      </PostCard>
      {related.length > 0 && (
        <>
          <div className="grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)]">
            <div aria-hidden className="relative">
              <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2" style={{ background: laneOf(post) }} />
            </div>
            <h2 className="m-0 border-b border-kumo-line py-2 font-mono text-xs text-kumo-subtle">
              {related.length} more {post.source === 'road' ? 'on this road' : 'in this area'}
            </h2>
          </div>
          <ul className="m-0 list-none p-0">
            {related.map((p, i) => (
              <li key={p.id}>
                <PostCard
                  post={p}
                  now={now}
                  incoming={laneOf(i ? related[i - 1] : post)}
                  grouped={(i ? related[i - 1] : post).publisher === p.publisher}
                  continues={i < related.length - 1}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
