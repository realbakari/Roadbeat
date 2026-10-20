import { Button } from '@cloudflare/kumo'
import { InfoIcon, KeyboardIcon, MagnifyingGlassIcon, MapTrifoldIcon, MoonIcon, PulseIcon, RowsIcon, SquaresFourIcon, SunIcon, type Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { RelativeTime } from '../components/ui/RelativeTime'
import { useColorMode } from '../hooks/useColorMode'
import type { PostSource } from '../lib/posts'

// The timeline's frame, laid out like a social site: a nav rail on the left
// (icons at tablet width, labels from desktop), a sources rail on the right
// from wide screens, and on phones a header and a bottom bar.

/** One source the timeline merges, and how its last read went. */
export interface SourceState {
  source: PostSource | 'history'
  name: string
  publisher: string
  loaded: boolean
  error: string | null
  at: number | null
}

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: '/', label: 'Map', icon: MapTrifoldIcon },
  { href: '/dashboard', label: 'Dashboard', icon: SquaresFourIcon },
  { href: '/status', label: 'Feed status', icon: PulseIcon },
  { href: '/about/', label: 'About', icon: InfoIcon },
]

function ModeButton() {
  const { mode, toggle } = useColorMode()
  return <Button variant="ghost" shape="square" aria-label="Toggle colour mode" icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={toggle} />
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-2" title="Open the map">
      <img src="/favicon.svg" alt="" className={small ? 'size-7' : 'size-8'} />
      <span className={`font-bold tracking-tight text-kumo-strong ${small ? 'text-lg' : 'text-2xl max-lg:sr-only'}`}>Roadbeat</span>
    </a>
  )
}

export function NavRail() {
  return (
    <nav aria-label="Roadbeat" className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col px-3.5 py-6 md:flex lg:w-64">
      <div className="mb-8 grid gap-1 px-2.5 lg:px-3">
        <Wordmark />
        <p className="m-0 text-sm text-kumo-subtle max-lg:hidden">Queensland's official feeds, as one timeline</p>
      </div>
      <ul className="m-0 grid list-none gap-1 p-0">
        <li>
          <a href="/timeline" aria-current="page" title="Timeline" className="flex h-11 items-center gap-3 rounded-lg bg-kumo-brand/10 px-4 text-[15px] font-semibold text-kumo-brand">
            <RowsIcon size={20} weight="bold" aria-hidden /> <span className="max-lg:sr-only">Timeline</span>
          </a>
        </li>
        {NAV.map((n) => (
          <li key={n.href}>
            <a href={n.href} title={n.label} className="flex h-11 items-center gap-3 rounded-lg px-4 text-[15px] font-medium text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default">
              <n.icon size={20} aria-hidden /> <span className="max-lg:sr-only">{n.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-auto px-1">
        <ModeButton />
      </div>
    </nav>
  )
}

/** Phones: the name, search and the colour mode, above the tabs; it scrolls away, the tabs stay. */
export function MobileHeader({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-kumo-line px-4 md:hidden">
      <Wordmark small />
      <span className="text-kumo-subtle">Timeline</span>
      <span className="ml-auto flex items-center">
        <Button variant="ghost" shape="square" aria-label="Search the timeline" icon={<MagnifyingGlassIcon />} onClick={onSearch} />
        <ModeButton />
      </span>
    </div>
  )
}

/** The search button at the top of the right rail, as social sites put it. */
function SearchButton({ onSearch }: { onSearch: () => void }) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <button
      type="button"
      onClick={onSearch}
      className="-mb-2 flex h-11 items-center gap-2.5 rounded-lg border border-kumo-line bg-kumo-base px-4 text-[15px] text-kumo-subtle transition-colors hover:border-kumo-strong/30 hover:text-kumo-default"
    >
      <MagnifyingGlassIcon size={16} aria-hidden /> Search the timeline
      <kbd className="ml-auto rounded border border-b-2 border-kumo-line bg-kumo-recessed px-1.5 font-mono text-xs">{mac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  )
}

/** Phones: the other screens, as a bottom bar. */
export function MobileNav() {
  const items: { href: string; label: string; icon: Icon; current?: boolean }[] = [
    { href: '/', label: 'Map', icon: MapTrifoldIcon },
    { href: '/timeline', label: 'Timeline', icon: RowsIcon, current: true },
    { href: '/dashboard', label: 'Dashboard', icon: SquaresFourIcon },
    { href: '/status', label: 'Status', icon: PulseIcon },
  ]
  return (
    <nav aria-label="Roadbeat" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-kumo-line bg-kumo-base pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map((i) => (
        <a
          key={i.href}
          href={i.href}
          aria-current={i.current ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[11px] font-medium tracking-tight ${i.current ? 'text-kumo-brand' : 'text-kumo-subtle'}`}
        >
          <span className={`flex h-8 w-14 items-center justify-center rounded-full ${i.current ? 'bg-kumo-brand/10' : ''}`}>
            <i.icon size={20} weight={i.current ? 'bold' : 'regular'} aria-hidden />
          </span>
          {i.label}
        </a>
      ))}
    </nav>
  )
}

export function SourcesCard({ sources, counts, now }: { sources: SourceState[]; counts: Record<string, number>; now: number }) {
  return (
    <section aria-labelledby="sources-heading" className="rounded-xl border border-kumo-line bg-kumo-base p-4">
      <h2 id="sources-heading" className="m-0 font-semibold text-kumo-strong">
        Sources
      </h2>
      <ul className="m-0 mt-3 grid list-none gap-3 p-0">
        {sources.map((s) => (
          <li key={s.source} className="grid gap-0.5 text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-kumo-default">{s.name}</span>
              {s.source !== 'history' && s.loaded && (
                <span className="font-mono text-xs text-kumo-subtle tabular-nums" title="Posts from it in the timeline">
                  {counts[s.source] ?? 0}
                </span>
              )}
            </span>
            <span className="text-xs text-kumo-subtle">{s.publisher}</span>
            <span className={`text-xs ${s.error ? 'text-kumo-danger' : 'text-kumo-subtle'}`}>
              {s.error ? (
                <>Failed: {s.error}</>
              ) : !s.loaded ? (
                'Loading…'
              ) : s.at != null ? (
                <>
                  Read <RelativeTime at={s.at} now={now} />
                </>
              ) : (
                'Loaded'
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Aside({ children, onShortcuts, onSearch }: { children: ReactNode; onShortcuts: () => void; onSearch: () => void }) {
  return (
    <aside aria-label="Search and sources" className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col gap-8 overflow-y-auto p-6 xl:flex">
      <SearchButton onSearch={onSearch} />
      {children}
      <section className="text-sm">
        <h2 className="m-0 font-semibold text-kumo-strong">Read-only, by design</h2>
        <p className="m-0 mt-1 text-pretty text-kumo-subtle">
          Only official publishers post here, in their own words. There are no accounts, likes or replies, because no source publishes them and Roadbeat doesn't invent them.
        </p>
      </section>
      <p className="m-0 -mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-kumo-line pt-4 text-sm text-kumo-subtle">
        <a href="/about/" className="hover:text-kumo-default">
          About
        </a>
        <a href="/privacy/" className="hover:text-kumo-default">
          Privacy
        </a>
        <a href="/status" className="hover:text-kumo-default">
          Feed status
        </a>
      </p>
      <button type="button" onClick={onShortcuts} className="mt-auto inline-flex w-fit items-center gap-2 text-sm text-kumo-subtle hover:text-kumo-default">
        <KeyboardIcon size={16} aria-hidden /> Keyboard shortcuts{' '}
        <kbd className="rounded border border-b-2 border-kumo-line bg-kumo-recessed px-1.5 font-mono text-xs">?</kbd>
      </button>
    </aside>
  )
}
