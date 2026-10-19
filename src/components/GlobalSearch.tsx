import { Dialog } from '@cloudflare/kumo'
import {
  ArrowElbowDownLeftIcon,
  BuildingsIcon,
  CameraIcon,
  CarProfileIcon,
  ClockCounterClockwiseIcon,
  DropIcon,
  FlameIcon,
  GasPumpIcon,
  HouseLineIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NewspaperIcon,
  PathIcon,
  TrainIcon,
  VideoCameraIcon,
  WarningIcon,
  WindIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { loadLocalities } from '../api/localities'
import { useStopIndex, useTransit } from '../hooks/useTransitFeeds'
import type { Locality } from '../lib/locality'
import { groupHits, KIND_LABEL, MIN_QUERY, searchIn, searchIndex, unloadedLayers, words, type SearchHit, type SearchKind, type SearchSources } from '../lib/search'
import { clearRecentSearches, matchRuns, rememberSearch, useRecentSearches } from '../lib/searchRecent'

/** What the app has loaded; the search adds the towns, stops and lines it reads itself. */
export type LoadedSources = Omit<SearchSources, 'towns' | 'stops' | 'lines'>

/** Each kind's icon and colour, close to the colours its layer uses on the map. */
const KIND_STYLE: Record<SearchKind, [Icon, string]> = {
  town: [BuildingsIcon, '#be185d'],
  event: [CarProfileIcon, '#ca8a04'],
  line: [PathIcon, '#4f46e5'],
  stop: [TrainIcon, '#059669'],
  camera: [VideoCameraIcon, '#0284c7'],
  warning: [WarningIcon, '#d97706'],
  fire: [FlameIcon, '#dc2626'],
  fuel: [GasPumpIcon, '#15803d'],
  speedcamera: [CameraIcon, '#64748b'],
  place: [MapPinIcon, '#64748b'],
  news: [NewspaperIcon, '#7c3aed'],
  centre: [HouseLineIcon, '#0d9488'],
  outage: [LightningIcon, '#ca8a04'],
  air: [WindIcon, '#0891b2'],
  gauge: [DropIcon, '#0369a1'],
}

/** Searches to try on an empty box, one per kind of thing people look for. */
const SUGGESTIONS = ['Gympie', 'Bruce Highway', 'Central station', 'T1 Caboolture', 'Toowoomba']

/** Whether a key press landed where typing is expected, so "/" there is text, not a shortcut. */
function inTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-kumo-line bg-kumo-recessed px-1 font-sans text-[11px] leading-4 text-kumo-subtle">{children}</kbd>
}

function KindTile({ kind }: { kind: SearchKind }) {
  const [I, color] = KIND_STYLE[kind]
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }} aria-hidden>
      <I size={17} weight="fill" />
    </span>
  )
}

/**
 * The header's Search button and the search it opens: one search over
 * everything the app has loaded, grouped by kind. "/" or Cmd/Ctrl+K opens it
 * from anywhere but a text field.
 */
export function GlobalSearch({ sources, onOpen }: { sources: LoadedSources; onOpen: (href: string) => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const palette = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextField(e.target)
      if (!palette && !slash) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search Roadbeat"
        aria-keyshortcuts="/ Control+K Meta+K"
        className="flex size-9 shrink-0 items-center justify-center gap-2 rounded-lg text-kumo-subtle ring-kumo-line hover:bg-kumo-tint hover:text-kumo-default md:h-9 md:w-56 md:justify-start md:bg-kumo-recessed md:px-3 md:ring lg:w-44 xl:w-60"
      >
        <MagnifyingGlassIcon size={18} />
        <span className="hidden flex-1 text-left text-sm md:inline">Search</span>
        <span className="hidden md:inline">
          <Kbd>/</Kbd>
        </span>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog size="lg" className="flex max-h-[min(80vh,640px)] flex-col overflow-hidden p-0">
          <Dialog.Title className="sr-only">Search Roadbeat</Dialog.Title>
          {/* Keyed on `open` so each opening starts a fresh search. */}
          <SearchPanel
            key={String(open)}
            sources={sources}
            onClose={() => setOpen(false)}
            onOpen={(hit) => {
              rememberSearch(hit)
              setOpen(false)
              onOpen(hit.href)
            }}
          />
        </Dialog>
      </Dialog.Root>
    </>
  )
}

function SearchPanel({ sources, onOpen, onClose }: { sources: LoadedSources; onOpen: (hit: SearchHit) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const recent = useRecentSearches()
  const live = query.trim().length >= MIN_QUERY
  // The towns, the train, tram and ferry stops and Translink's lines are read once the search is in use.
  const stops = useStopIndex(live, false)
  const transit = useTransit(live)
  const [towns, setTowns] = useState<Locality[] | null>(null)
  useEffect(() => {
    if (!live || towns) return
    let current = true
    loadLocalities().then((t) => current && setTowns(t))
    return () => {
      current = false
    }
  }, [live, towns])

  const all = useMemo<SearchSources>(() => ({ ...sources, towns, stops, lines: transit.data?.lines ?? null }), [sources, towns, stops, transit.data])
  // Built once per load of the data, not on every key press.
  const index = useMemo(() => searchIndex(all), [all])
  const hits = useMemo(() => (live ? searchIn(index, query) : []), [index, query, live])
  const groups = useMemo(() => groupHits(hits), [hits])
  // With no query, the arrow keys walk the recent list instead.
  const ordered = useMemo(() => (live ? groups.flatMap((g) => g.hits) : recent), [live, groups, recent])
  const qWords = useMemo(() => words(query), [query])
  const missing = live ? unloadedLayers(all) : []
  const activeHit = ordered[Math.min(active, ordered.length - 1)]
  const optionId = (hit: SearchHit) => `${listId}-${hit.href}`

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!ordered.length) return
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + ordered.length) % ordered.length)
    } else if (e.key === 'Enter' && activeHit) {
      e.preventDefault()
      onOpen(activeHit)
    }
  }

  const row = (hit: SearchHit) => {
    const selected = hit === activeHit
    return (
      <li
        key={hit.href}
        id={optionId(hit)}
        role="option"
        aria-selected={selected}
        className={`relative mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${selected ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
        onMouseMove={() => !selected && setActive(ordered.indexOf(hit))}
        onClick={() => onOpen(hit)}
      >
        {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-kumo-brand" aria-hidden />}
        <KindTile kind={hit.kind} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-kumo-default">
            {matchRuns(hit.title, live ? qWords : []).map((r, i) =>
              r.match ? (
                <mark key={i} className="bg-transparent font-semibold text-kumo-strong">
                  {r.text}
                </mark>
              ) : (
                <span key={i}>{r.text}</span>
              ),
            )}
          </span>
          {hit.detail && <span className="block truncate text-xs text-kumo-subtle">{hit.detail}</span>}
        </span>
        {selected && <ArrowElbowDownLeftIcon size={14} className="hidden shrink-0 text-kumo-subtle sm:block" aria-hidden />}
      </li>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-kumo-line px-4">
        <MagnifyingGlassIcon size={20} className="shrink-0 text-kumo-subtle" aria-hidden />
        <input
          ref={input}
          autoFocus
          role="combobox"
          aria-label="Search Roadbeat"
          aria-expanded={ordered.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeHit ? optionId(activeHit) : undefined}
          placeholder="Search towns, roads, stations, lines…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-kumo-default outline-none placeholder:text-kumo-subtle"
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => (setQuery(''), input.current?.focus())} className="rounded-md p-1.5 text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default">
            <XIcon size={16} />
          </button>
        ) : (
          <button type="button" onClick={onClose} className="rounded-md px-1.5 py-1 text-xs text-kumo-subtle hover:bg-kumo-tint">
            Esc
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <ul id={listId} role="listbox" aria-label={live ? 'Search results' : 'Recent searches'}>
          {live
            ? groups.map((g) => (
                <li key={g.kind} role="group" aria-labelledby={`${listId}-${g.kind}`} className="pb-1">
                  <div id={`${listId}-${g.kind}`} className="px-4 pt-2 pb-1 text-xs font-medium text-kumo-subtle">
                    {KIND_LABEL[g.kind]}
                  </div>
                  <ul role="none">{g.hits.map(row)}</ul>
                </li>
              ))
            : recent.length > 0 && (
                <li role="group" aria-labelledby={`${listId}-recent`} className="pb-1">
                  <div className="flex items-center justify-between px-4 pt-1 pb-1">
                    <span id={`${listId}-recent`} className="flex items-center gap-1.5 text-xs font-medium text-kumo-subtle">
                      <ClockCounterClockwiseIcon size={13} aria-hidden /> Recent
                    </span>
                    <button type="button" onClick={clearRecentSearches} className="text-xs text-kumo-link hover:underline">
                      Clear
                    </button>
                  </div>
                  <ul role="none">{recent.map(row)}</ul>
                </li>
              )}
        </ul>

        {!live && (
          <div className="px-4 pt-2 pb-1">
            <p className="m-0 text-xs font-medium text-kumo-subtle">Try</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => (setQuery(s), setActive(0), input.current?.focus())}
                  className="rounded-md px-2.5 py-1 text-sm text-kumo-default ring ring-kumo-line hover:bg-kumo-tint"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="m-0 mt-3 text-xs text-kumo-subtle">Searches towns and suburbs, road events, Translink lines and stops, cameras and warnings, and every map layer that's on.</p>
          </div>
        )}

        {live && !hits.length && (
          <div role="status" className="px-4 py-3">
            <p className="m-0 font-semibold">Nothing loaded matches “{query.trim()}”</p>
            <p className="m-0 mt-0.5 text-sm text-kumo-subtle">Try a town, road or station name, or turn on the layer that has it.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-kumo-line px-4 py-2 text-xs text-kumo-subtle">
        <span className="hidden items-center gap-1.5 sm:flex">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Kbd>↵</Kbd> to open
        </span>
        {missing.length > 0 && <span className="min-w-0 flex-1 truncate sm:text-right" title={missing.join(', ')}>Not searched until their layer is on: {missing.join(', ')}</span>}
      </div>
    </>
  )
}
