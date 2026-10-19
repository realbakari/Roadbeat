import { Button, Input } from '@cloudflare/kumo'
import { BookmarkSimpleIcon, MapPinSimpleIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import type { TrafficEvent } from '../api/types'
import type { Locality } from '../lib/locality'
import { forgetPlace, keepPlace, NEAR_PLACE_KM, placeSummary, useSavedPlaces } from '../lib/savedPlaces'

/** The rider's saved places above the road events, each with what QLDTraffic reports near it. Hidden until one is saved. */
export function MyPlaces({ events, now, onOpen }: { events: TrafficEvent[]; now: number; onOpen: (href: string) => void }) {
  const places = useSavedPlaces()
  if (!places.length) return null
  return (
    <section aria-label="My places" className="mx-4 mt-3 overflow-hidden rounded-lg ring ring-kumo-line">
      <h2 className="bg-kumo-recessed px-3 py-1.5 text-xs text-kumo-subtle">My places · road events within {NEAR_PLACE_KM} km</h2>
      <ul className="divide-y divide-kumo-line">
        {places.map((p) => {
          const s = placeSummary(p, events, now)
          return (
            <li key={p.name}>
              <button type="button" onClick={() => onOpen(`place/locality/${encodeURIComponent(p.name)}`)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-kumo-tint">
                <MapPinSimpleIcon size={16} weight="fill" className="shrink-0 text-kumo-link" aria-hidden />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-sm">
                    {p.nickname}
                    {p.nickname !== p.name && <span className="text-kumo-subtle"> · {p.name}</span>}
                  </span>
                  <span className="text-xs text-kumo-subtle">
                    {s.events ? `${s.events} road ${s.events === 1 ? 'event' : 'events'}${s.closures ? `, ${s.closures} ${s.closures === 1 ? 'closure' : 'closures'}` : ''}` : 'No road events reported nearby'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** "Save place" on a place page, with a nickname, or "Saved as Home" with a way to remove it. */
export function SavePlace({ locality }: { locality: Locality }) {
  const places = useSavedPlaces()
  const saved = places.find((p) => p.name === locality.name)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  if (saved && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <BookmarkSimpleIcon size={16} weight="fill" className="text-kumo-link" aria-hidden />
        <span>Saved as {saved.nickname}</span>
        <Button size="sm" variant="ghost" onClick={() => (setNickname(saved.nickname), setEditing(true))}>
          Rename
        </Button>
        <Button size="sm" variant="ghost" icon={<XIcon />} onClick={() => forgetPlace(locality.name)}>
          Remove
        </Button>
      </div>
    )
  }
  if (!editing) {
    return (
      <Button size="sm" icon={<BookmarkSimpleIcon />} onClick={() => (setNickname(''), setEditing(true))} className="w-fit">
        Save place
      </Button>
    )
  }
  const done = () => {
    keepPlace({ name: locality.name, nickname, position: locality.position })
    setEditing(false)
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        done()
      }}
    >
      <Input label="Nickname" placeholder={`${locality.name}, or Home, Work…`} value={nickname} onChange={(e) => setNickname(e.target.value)} size="sm" className="w-56" autoFocus />
      <Button size="sm" variant="primary" type="submit">
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </form>
  )
}
