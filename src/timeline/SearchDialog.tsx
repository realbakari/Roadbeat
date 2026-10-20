import { Dialog } from '@cloudflare/kumo'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { RelativeTime } from '../components/ui/RelativeTime'
import type { Post } from '../lib/posts'
import { groupResults, searchPosts } from '../lib/postSearch'
import { timelinePath } from '../lib/route'
import { isPlainClick } from './navigation'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  posts: Post[]
  /** Feeds not in the search because they haven't loaded or failed, by name. */
  missing: string[]
  now: number
  onOpen: (post: Post) => void
}

/**
 * Search over the posts that have loaded, opened with / or ⌘K: results grouped
 * by source, ↑ and ↓ to move, Enter to open. It looks nothing up elsewhere,
 * and names any feed it couldn't search.
 */
export function SearchDialog({ open, onOpenChange, posts, missing, now, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const groups = useMemo(() => groupResults(searchPosts(posts, query)), [posts, query])
  const flat = groups.flatMap((g) => g.posts)
  const choose = (p: Post) => {
    onOpenChange(false)
    setQuery('')
    onOpen(p)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!flat.length) return
      const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length
      setActive(next)
      document.getElementById(`search-hit-${next}`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      choose(flat[active])
    }
  }
  let n = -1

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQuery('')
      }}
    >
      <Dialog size="lg" className="top-[12vh] flex max-h-[70vh] translate-y-0 flex-col overflow-hidden p-0">
        <Dialog.Title className="sr-only">Search the timeline</Dialog.Title>
        <div className="flex items-center gap-3 border-b border-kumo-line px-4">
          <MagnifyingGlassIcon size={20} className="shrink-0 text-kumo-subtle" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder="Search roads, places, publishers or #event numbers"
            aria-label="Search the timeline"
            aria-controls="search-results"
            aria-activedescendant={flat.length ? `search-hit-${active}` : undefined}
            role="combobox"
            aria-expanded={flat.length > 0}
            className="h-14 min-w-0 flex-1 bg-transparent text-[17px] text-kumo-strong outline-none placeholder:text-kumo-subtle"
          />
          <kbd className="rounded border border-b-2 border-kumo-line bg-kumo-recessed px-1.5 font-mono text-xs text-kumo-subtle">esc</kbd>
        </div>

        <div id="search-results" role="listbox" aria-label="Posts found" className="min-h-0 flex-1 overflow-y-auto">
          {!query.trim() ? (
            <p className="m-0 px-4 py-6 text-sm text-kumo-subtle">Search the {posts.length} posts in the feeds that have loaded, by road, place, publisher, event number or the publisher's own words.</p>
          ) : flat.length === 0 ? (
            <p className="m-0 px-4 py-6 text-sm text-kumo-subtle">No posts in the loaded feeds match “{query.trim()}”.</p>
          ) : (
            groups.map((g) => (
              <section key={g.label} aria-label={g.label} className="py-1">
                <h2 className="m-0 px-4 pt-2 pb-1 font-mono text-xs font-medium tracking-wide text-kumo-subtle uppercase">{g.label}</h2>
                {g.posts.map((p) => {
                  n += 1
                  const i = n
                  return (
                    <a
                      key={p.id}
                      id={`search-hit-${i}`}
                      role="option"
                      aria-selected={i === active}
                      href={timelinePath(p.id)}
                      onMouseMove={() => setActive(i)}
                      onClick={(e) => {
                        if (!isPlainClick(e)) return
                        e.preventDefault()
                        choose(p)
                      }}
                      className={`grid gap-0.5 px-4 py-2 ${i === active ? 'bg-kumo-tint' : ''}`}
                    >
                      <span className="flex min-w-0 items-baseline gap-1.5 text-[15px]">
                        <span className="truncate font-medium text-kumo-strong">{p.title}</span>
                        <span className="shrink-0 font-mono text-[13px] text-kumo-subtle">
                          · <RelativeTime at={p.latest} now={now} inline />
                        </span>
                      </span>
                      <span className="truncate font-mono text-xs text-kumo-subtle">{[p.publisher, p.kind, p.place, p.ref].filter(Boolean).join(' · ')}</span>
                    </a>
                  )
                })}
                {g.more > 0 && <p className="m-0 px-4 py-1 text-xs text-kumo-subtle">and {g.more} more; add a word to narrow it</p>}
              </section>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-kumo-line px-4 py-2 font-mono text-xs text-kumo-subtle">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          {missing.length > 0 && <span className="text-kumo-warning">Not searched: {missing.join(', ')}</span>}
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
