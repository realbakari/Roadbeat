import { InputGroup } from '@cloudflare/kumo'
import {
  CarProfileIcon,
  DropIcon,
  FlameIcon,
  HouseLineIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NewspaperIcon,
  TrainIcon,
  VideoCameraIcon,
  WindIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStopIndex } from '../hooks/useTrafficData'
import { groupHits, KIND_LABEL, MIN_QUERY, search, unloadedLayers, type SearchHit, type SearchKind, type SearchSources } from '../lib/search'

interface Props {
  /** Everything loaded so far; the stop index is added here. */
  sources: Omit<SearchSources, 'stops'>
  onOpen: (href: string) => void
}

const KIND_ICON: Record<SearchKind, Icon> = {
  event: CarProfileIcon,
  camera: VideoCameraIcon,
  stop: TrainIcon,
  place: MapPinIcon,
  news: NewspaperIcon,
  centre: HouseLineIcon,
  outage: LightningIcon,
  air: WindIcon,
  gauge: DropIcon,
  fire: FlameIcon,
}

/** Whether a key press landed where typing is expected, so "/" there is text, not a shortcut. */
function inTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

/**
 * One search over everything the app has loaded, in the header. Results are
 * grouped by kind; arrow keys move, Enter opens, Escape closes. "/" or
 * Cmd/Ctrl+K focuses it from anywhere but a text field.
 */
export function GlobalSearch({ sources, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const live = query.trim().length >= MIN_QUERY
  // Train, tram and ferry stops are a small file, read once the search is in use.
  const stops = useStopIndex(live, false)
  const all = useMemo<SearchSources>(() => ({ ...sources, stops }), [sources, stops])
  const hits = useMemo(() => (live ? search(all, query) : []), [all, query, live])
  const groups = useMemo(() => groupHits(hits), [hits])
  const missing = useMemo(() => (live ? unloadedLayers(all) : []), [all, live])
  // The flat list the arrow keys walk, in the order shown.
  const ordered = useMemo(() => groups.flatMap((g) => g.hits), [groups])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const palette = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextField(e.target)
      if (!palette && !slash) return
      e.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choose = (hit: SearchHit) => {
    onOpen(hit.href)
    setOpen(false)
    input.current?.blur()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) setOpen(false)
      else if (query) setQuery('')
      else input.current?.blur()
      e.preventDefault()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!ordered.length) return
      e.preventDefault()
      setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + ordered.length) % ordered.length)
    } else if (e.key === 'Enter') {
      const hit = ordered[active]
      if (hit && open) {
        e.preventDefault()
        choose(hit)
      }
    }
  }

  const expanded = open && live
  const activeHit = ordered[Math.min(active, ordered.length - 1)]
  const optionId = (hit: SearchHit) => `${listId}-${hit.href}`

  return (
    <div
      className="relative min-w-0 flex-1 md:max-w-xs lg:max-w-sm"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <InputGroup>
        <InputGroup.Addon>
          <MagnifyingGlassIcon />
        </InputGroup.Addon>
        <InputGroup.Input
          ref={input}
          role="combobox"
          aria-label="Search Roadbeat"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeHit ? optionId(activeHit) : undefined}
          placeholder="Search roads, cameras, stations, places…"
          title="Search (press / or ⌘K)"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query && <InputGroup.Button variant="ghost" shape="square" aria-label="Clear search" icon={<XIcon />} onClick={() => (setQuery(''), input.current?.focus())} />}
      </InputGroup>
      {expanded && (
        <div className="absolute top-full left-0 z-30 mt-1 max-h-[min(70vh,560px)] w-[min(440px,calc(100vw-32px))] overflow-y-auto rounded-lg bg-kumo-base py-1 shadow-md ring ring-kumo-line">
          <ul id={listId} role="listbox" aria-label="Search results">
            {groups.map((g) => (
              <li key={g.kind} role="group" aria-labelledby={`${listId}-${g.kind}`}>
                <div id={`${listId}-${g.kind}`} className="px-3 pt-2 pb-1 text-xs font-medium text-kumo-subtle">
                  {KIND_LABEL[g.kind]}
                </div>
                <ul role="none">
                  {g.hits.map((hit) => {
                    const I = KIND_ICON[hit.kind]
                    const selected = hit === activeHit
                    return (
                      <li
                        key={hit.href}
                        id={optionId(hit)}
                        role="option"
                        aria-selected={selected}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 ${selected ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'}`}
                        onMouseEnter={() => setActive(ordered.indexOf(hit))}
                        // Keep focus in the input so blur does not close the list before the click lands.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(hit)}
                      >
                        <I size={18} className="shrink-0 text-kumo-subtle" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{hit.title}</span>
                          <span className="block truncate text-xs text-kumo-subtle">{hit.detail}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {!hits.length && <p className="px-3 py-2 text-sm text-kumo-subtle">Nothing loaded matches “{query.trim()}”.</p>}
          {missing.length > 0 && (
            <p className="border-t border-kumo-line px-3 pt-2 pb-1 text-xs text-kumo-subtle">
              {missing.length === 1 ? `Load the ${missing[0]} layer to search it.` : `Load the ${missing.slice(0, -1).join(', ')} or ${missing[missing.length - 1]} layer to search it.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
