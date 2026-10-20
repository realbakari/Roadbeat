import { Banner, Button } from '@cloudflare/kumo'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { useBushfires } from '../hooks/useHazardFeeds'
import { useNews } from '../hooks/useNews'
import { useNow } from '../hooks/useNow'
import { useQldWarnings } from '../hooks/useQldWarnings'
import { useTrafficData } from '../hooks/useRoadFeeds'
import { useEventHistory } from '../hooks/useTimeline'
import { useTransitAlerts } from '../hooks/useTransitFeeds'
import { loadSettings } from '../lib/alertRules'
import { dayKey, dayLabel, holdOrder, snapshotOf, type FeedSnapshot } from '../lib/feedOrder'
import { groupStories } from '../lib/newsStories'
import { buildPosts, gatherRelated, laneOf, mostActive, postsFor, type FeedEntry, type PostView } from '../lib/posts'
import { parsePath, timelinePath } from '../lib/route'
import { DayMarker, FeedEnd, FeedSkeleton, FeedTabs, NewPostsButton } from './FeedParts'
import { FuelFeed } from './FuelFeed'
import { VIEWS } from './navigation'
import { PostCard } from './PostCard'
import { PostPage } from './PostPage'
import { Aside, MobileHeader, MobileNav, NavRail, SourcesCard, type SourceState } from './Shell'
import { SearchDialog } from './SearchDialog'
import { ShortcutsDialog } from './ShortcutsDialog'
import { useTimelineKeys } from './useTimelineKeys'

// /timeline: every official source Roadbeat reads, as one feed of posts, laid
// out like a social network's timeline. Only publishers post: nothing is
// liked, ranked or written by Roadbeat or its readers. The tab is kept in the
// address (?view=major), and a post opens at /timeline/<source>/<id> in place.

const PAGE = 40
/** How far down the feed counts as reading rather than at the top, in pixels. */
const READING = 120

const isView = (v: unknown): v is PostView => VIEWS.some((x) => x.value === v)
const viewIn = (search: string): PostView => {
  const v = new URLSearchParams(search).get('view')
  return isView(v) ? v : 'latest'
}
const feedPath = (view: PostView) => (view === 'latest' ? timelinePath(null) : `${timelinePath(null)}?view=${view}`)

/** The post a timeline address names, or null for the feed. */
const postIn = (path: string) => {
  const screen = parsePath(path)
  return screen.kind === 'timeline' ? screen.post : null
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function TimelinePage({ post: initialPost }: { post: string | null }) {
  const now = useNow(30_000)
  const traffic = useTrafficData()
  const fires = useBushfires(true)
  const qw = useQldWarnings()
  const transit = useTransitAlerts(true)
  const news = useNews(true)
  const { history, error: historyError } = useEventHistory(true)
  const [watched] = useState(() => loadSettings().watchedEvents)
  const [view, setView] = useState<PostView>(() => viewIn(location.search))
  const [shown, setShown] = useState(PAGE)
  const [helpOpen, setHelpOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // The open post lives in the address, changed in place so the feeds stay loaded.
  const [postId, setPostId] = useState(initialPost)
  const scroller = useRef<HTMLDivElement>(null)
  const feedScroll = useRef(0)
  const pushed = useRef(false)

  // While the reader is down the feed, the order they see holds still; null means it follows the feeds live.
  const [held, setHeld] = useState<FeedSnapshot | null>(null)

  useEffect(() => {
    const onPop = () => {
      setPostId(postIn(location.pathname))
      setView(viewIn(location.search))
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  const stories = useMemo(() => (news.snapshot ? groupStories(news.snapshot.items) : []), [news.snapshot])
  const events = traffic.fetchedAt == null ? null : traffic.events
  const posts = useMemo(
    () => buildPosts({ events, fires: fires.fires, warnings: qw.warnings, alerts: transit.alerts, stories, history, now }),
    [events, fires.fires, qw.warnings, transit.alerts, stories, history, now],
  )
  const live = useMemo(() => postsFor(posts, view, watched, now), [posts, view, watched, now])
  const holding = useMemo(() => (held ? holdOrder(held, live) : null), [held, live])
  const list = holding?.posts ?? live
  // Most active is grouped by its ranking, each road or area under a heading with its count; the other tabs gather related posts in time order.
  const entries = useMemo<(FeedEntry & { heading?: string })[]>(
    () =>
      view === 'active'
        ? mostActive(posts, now).flatMap((t) =>
            t.posts.map((post, i) => ({
              post,
              joined: i > 0,
              heading: i ? undefined : `${t.name} · ${t.count} ${t.count === 1 ? 'post or update' : 'posts and updates'} in the last 6 hours`,
            })),
          )
        : gatherRelated(list),
    [view, posts, now, list],
  )
  const page = entries.slice(0, shown)
  const openedPost = postId ? (posts.find((p) => p.id === postId) ?? null) : null
  const counts = useMemo(() => posts.reduce<Record<string, number>>((c, p) => ({ ...c, [p.source]: (c[p.source] ?? 0) + 1 }), {}), [posts])

  const sources: SourceState[] = [
    { source: 'road', name: 'Road events', publisher: 'QLDTraffic (Transport and Main Roads)', loaded: events != null, error: events == null ? traffic.error : null, at: traffic.fetchedAt },
    { source: 'fire', name: 'Bushfires', publisher: 'Queensland Fire Department', loaded: fires.fires != null, error: fires.fires == null ? fires.error : null, at: fires.fetchedAt },
    { source: 'warning', name: 'Hazard warnings', publisher: 'Queensland Disaster Management', loaded: qw.warnings != null, error: qw.warnings == null ? qw.error : null, at: qw.fetchedAt },
    { source: 'transit', name: 'Service alerts', publisher: 'Translink', loaded: transit.alerts != null, error: transit.alerts == null ? transit.error : null, at: null },
    { source: 'news', name: 'News and notices', publisher: 'News outlets, police and councils', loaded: news.snapshot != null, error: news.snapshot == null ? news.error : null, at: news.snapshot?.fetchedAt ?? null },
    { source: 'history', name: 'Road event updates', publisher: "Roadbeat's 48-hour record of QLDTraffic", loaded: history != null, error: history == null ? historyError : null, at: history?.runs.at(-1)?.at ?? null },
  ]
  const failed = sources.filter((s) => s.error)
  const loading = sources.filter((s) => !s.loaded && !s.error && s.source !== 'history')
  const nothingYet = sources.every((s) => !s.loaded)
  const postSource = postId ? sources.find((s) => s.source === postId.split(':')[0]) : undefined

  useEffect(() => {
    document.title = openedPost ? `${openedPost.title} · ${openedPost.publisher} · Roadbeat timeline` : 'Timeline · Roadbeat'
  }, [openedPost])
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = postId ? 0 : feedScroll.current
  }, [postId])

  const toTop = () => scroller.current?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
  const chooseView = (v: PostView) => {
    if (v === view) return
    window.history.replaceState(null, '', feedPath(v))
    setView(v)
    setShown(PAGE)
    setHeld(null)
    feedScroll.current = 0
    if (scroller.current) scroller.current.scrollTop = 0
  }
  const openPost = (id: string) => {
    if (!postId) feedScroll.current = scroller.current?.scrollTop ?? 0
    window.history.pushState(null, '', timelinePath(id))
    pushed.current = true
    setPostId(id)
  }
  const backToFeed = () => {
    // Back from a post opened here returns to the feed where it was; a post opened from a link goes to the top.
    if (pushed.current) window.history.back()
    else {
      window.history.pushState(null, '', feedPath(view))
      setPostId(null)
    }
  }
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    if (postId) return
    const reading = e.currentTarget.scrollTop > READING
    // Most active's order is its ranking, so it isn't held.
    if (reading && !held && view !== 'active' && view !== 'fuel') setHeld(snapshotOf(list))
    else if (!reading && held) setHeld(null)
  }
  const showNew = () => {
    setHeld(null)
    toTop()
  }

  useTimelineKeys({ onView: chooseView, onOpen: openPost, onBack: backToFeed, onHelp: () => setHelpOpen(true), onSearch: () => setSearchOpen(true), onPost: !!postId })

  const feed = (
    <>
      <MobileHeader onSearch={() => setSearchOpen(true)} />
      <h1 className="sr-only">Timeline</h1>
      <div className="sticky top-0 z-10 bg-kumo-base">
        <FeedTabs view={view} onChange={chooseView} />
      </div>
      {holding && holding.waiting > 0 && <NewPostsButton count={holding.waiting} onClick={showNew} />}
      {view === 'active' && (
        <p className="m-0 border-b border-kumo-line px-4 py-2.5 text-[13px] leading-relaxed text-kumo-subtle">
          Roads and areas ranked by how many posts and updates their publishers put out in the last 6 hours, counted from the publishers' own times. Not by readers: nothing
          here is liked or viewed.
        </p>
      )}

      {view !== 'fuel' && (failed.length > 0 || loading.length > 0) && !nothingYet && (
        <div className="grid gap-2 border-b border-kumo-line px-4 py-3">
          {failed.length > 0 && (
            <Banner
              variant="alert"
              size="sm"
              icon={<WarningCircleIcon weight="fill" />}
              description={`Couldn't load ${failed.map((s) => s.name.toLowerCase()).join(', ')}, so ${failed.length === 1 ? 'its' : 'their'} posts aren't here.${failed.some((s) => s.source === 'history') ? ' Road events show only their latest update.' : ''}`}
            />
          )}
          {loading.length > 0 && <p className="m-0 font-mono text-[13px] text-kumo-subtle">Still loading: {loading.map((s) => s.name.toLowerCase()).join(', ')}.</p>}
        </div>
      )}

      <div id="feed" role="tabpanel" aria-labelledby={`tab-${view}`}>
        {view === 'fuel' ? (
          <FuelFeed now={now} />
        ) : nothingYet ? (
          <FeedSkeleton />
        ) : entries.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-6 py-16 text-center sm:px-12">
            <p className="m-0 font-mono text-[13px] text-kumo-subtle">
              {view === 'watching'
                ? 'Not watching anything still listed'
                : view === 'major'
                  ? 'Nothing at a major level'
                  : view === 'active'
                    ? 'Nothing active in the last 6 hours'
                    : 'No posts in the loaded feeds'}
            </p>
            <p className="m-0 max-w-sm text-[15px] text-kumo-default">
              {view === 'watching' ? (
                <>
                  Use the bell on a road event in the{' '}
                  <a href="/" className="text-kumo-link underline decoration-1 underline-offset-2">
                    app
                  </a>
                  , and its updates show here.
                </>
              ) : view === 'major' ? (
                'Major means an Emergency Warning, Watch and Act or Red Alert, or a road QLDTraffic files as closed, at each publisher’s own level, in the feeds that have loaded.'
              ) : view === 'active' ? (
                'No road or area has a post or update from its publisher in the last 6 hours, in the feeds that have loaded.'
              ) : (
                'None of the loaded feeds has an item with a published time.'
              )}
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {page.map(({ post: p, joined, heading }, i) => {
              const above = joined ? page[i - 1]?.post : undefined
              // A day marker where the activity moves to an earlier Queensland day; related posts stay together under one. Most active has its own headings instead.
              const prevHead = page.slice(0, i).findLast((x) => !x.joined)
              const day = view !== 'active' && !joined && (prevHead ? dayKey(prevHead.post.latest) !== dayKey(p.latest) : dayKey(p.latest) !== dayKey(now))
              const marker = heading ?? (day ? dayLabel(p.latest, now) : null)
              return (
                <Fragment key={p.id}>
                  {marker && (
                    <li>
                      <DayMarker label={marker} />
                    </li>
                  )}
                  <li>
                    <PostCard
                      post={p}
                      now={now}
                      incoming={above ? laneOf(above) : null}
                      grouped={!!above && above.publisher === p.publisher && above.handle === p.handle}
                      continues={!!page[i + 1]?.joined}
                      onOpen={(q) => openPost(q.id)}
                    />
                  </li>
                </Fragment>
              )
            })}
          </ul>
        )}

        {view === 'fuel' ? null : entries.length > shown ? (
          <div className="border-b border-kumo-line px-4 py-3">
            <Button variant="secondary" className="w-full" onClick={() => setShown((s) => s + PAGE)}>
              Show {Math.min(PAGE, entries.length - shown)} more
            </Button>
          </div>
        ) : (
          entries.length > 0 && <FeedEnd>{view === 'active' ? "That's every road and area with activity in the last 6 hours." : "That's every post in the feeds that have loaded."}</FeedEnd>
        )}
      </div>

      <p className={`m-0 px-4 py-5 text-xs leading-relaxed text-kumo-subtle ${view === 'fuel' ? 'hidden' : ''}`}>
        Each post is a publisher's own item at its own time, newest activity first. Posts on the same road and locality, or the same fire or warning area, are gathered and
        joined on one lane. Road event updates come from Roadbeat's record of QLDTraffic's feed over the last 48 hours and say only which published fields changed. Translink
        alerts are listed from when they took effect, since Translink publishes no issue time. Nothing here is liked, ranked or written by Roadbeat.
      </p>
    </>
  )

  return (
    <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto bg-kumo-canvas [scrollbar-gutter:stable]">
      <div className="mx-auto flex min-h-full w-full max-w-[1264px] justify-center">
        <NavRail />
        <main className="min-w-0 flex-1 border-kumo-line bg-kumo-base pb-24 md:max-w-[620px] md:border-x md:pb-0">
          {postId ? (
            <PostPage
              post={openedPost}
              posts={posts}
              loading={!postSource?.loaded && !postSource?.error}
              error={postSource?.error ?? null}
              now={now}
              onBack={backToFeed}
              onOpen={(p) => openPost(p.id)}
            />
          ) : (
            feed
          )}
          {/* Below the rail's width, the sources card follows the feed. */}
          <div className="p-4 xl:hidden">
            <SourcesCard sources={sources} counts={counts} now={now} />
          </div>
        </main>
        <Aside onShortcuts={() => setHelpOpen(true)} onSearch={() => setSearchOpen(true)}>
          <SourcesCard sources={sources} counts={counts} now={now} />
        </Aside>
      </div>
      <MobileNav />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        posts={posts}
        missing={[...failed, ...loading].filter((s) => s.source !== 'history').map((s) => s.name.toLowerCase())}
        now={now}
        onOpen={(p) => openPost(p.id)}
      />
    </div>
  )
}
