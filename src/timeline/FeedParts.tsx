import { ArrowUpIcon } from '@phosphor-icons/react'
import type { KeyboardEvent } from 'react'
import type { PostView } from '../lib/posts'
import { VIEWS } from './navigation'

// The feed's own furniture: the tab bar, the "new posts" button, day markers,
// the end of the feed and loading rows. Each sits on the same rail as the posts.

const RAIL_GRID = 'grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)]'

/** Latest, Major and Watching as an underlined tab bar; the arrow keys move between them. */
export function FeedTabs({ view, onChange }: { view: PostView; onChange: (v: PostView) => void }) {
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = VIEWS.findIndex((v) => v.value === view)
    const next = e.key === 'ArrowRight' ? VIEWS[(i + 1) % VIEWS.length] : e.key === 'ArrowLeft' ? VIEWS[(i + VIEWS.length - 1) % VIEWS.length] : null
    if (!next) return
    e.preventDefault()
    onChange(next.value)
    document.getElementById(`tab-${next.value}`)?.focus()
  }
  return (
    <div role="tablist" aria-label="Which posts" className="flex border-b border-kumo-line">
      {VIEWS.map((v) => {
        const on = v.value === view
        return (
          <button
            key={v.value}
            id={`tab-${v.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="feed"
            aria-keyshortcuts={v.key}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(v.value)}
            onKeyDown={move}
            className={`flex flex-1 justify-center text-[15px] font-medium transition-colors hover:bg-kumo-tint focus-visible:bg-kumo-tint focus-visible:outline-none ${on ? 'text-kumo-strong' : 'text-kumo-subtle'}`}
          >
            <span className="relative py-3.5">
              {v.label}
              {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-kumo-brand" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Shown while the reader is down the feed and posts are new or updated above: one click brings them in. */
export function NewPostsButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="pointer-events-none sticky top-[3.25rem] z-10 flex h-0 justify-center">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-kumo-brand px-4 py-1.5 text-sm font-medium text-kumo-inverse shadow-md motion-safe:animate-[timeline-in_200ms_ease-out]"
      >
        <ArrowUpIcon size={14} weight="bold" aria-hidden /> {count} new or updated {count === 1 ? 'post' : 'posts'}
      </button>
    </div>
  )
}

/** A marker on the rail: a Queensland day, or a Most active road or area with its count. */
export function DayMarker({ label }: { label: string }) {
  return (
    <div className={RAIL_GRID} role="separator" aria-label={label}>
      <div aria-hidden className="relative">
        <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed" style={{ borderColor: 'var(--rail)' }} />
      </div>
      <p className="m-0 border-b border-kumo-line py-2 font-mono text-xs text-kumo-subtle">{label}</p>
    </div>
  )
}

/** The end of the feed: a hollow dot closing the rail, and what it covered. */
export function FeedEnd({ children }: { children: string }) {
  return (
    <div className={RAIL_GRID}>
      <div aria-hidden className="relative">
        <span className="absolute top-[1.3rem] left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-kumo-base" style={{ borderColor: 'var(--rail)' }} />
      </div>
      <p className="m-0 pt-[1.1rem] pr-4 pb-10 text-sm text-kumo-subtle">{children}</p>
    </div>
  )
}

/** Placeholder posts while the feeds load, shaped like the real ones. */
export function FeedSkeleton({ rows = 3, label = 'Loading posts' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={RAIL_GRID}>
          <div aria-hidden className="relative min-h-24">
            <span className="absolute top-8 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-kumo-base motion-safe:animate-pulse" style={{ background: 'var(--rail)' }} />
          </div>
          <div aria-hidden className="grid content-start gap-2.5 border-b border-kumo-line py-4 pr-4 motion-safe:animate-pulse">
            <span className="h-3 w-2/5 rounded" style={{ background: 'var(--rail)' }} />
            <span className="h-3 w-4/5 rounded" style={{ background: 'var(--rail)' }} />
            <span className="h-3 w-3/5 rounded" style={{ background: 'var(--rail)' }} />
            <span className="h-4 w-9 rounded" style={{ background: 'var(--rail)' }} />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}
