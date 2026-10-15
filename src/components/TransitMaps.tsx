import { InputGroup, Text } from '@cloudflare/kumo'
import { ArrowSquareOutIcon, CaretRightIcon, FilePdfIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import MAPS from '../data/translink-maps.json'
import { findStationMap } from '../lib/transitMaps'

type Region = (typeof MAPS)['regions'][number]

/**
 * Every map TransLink publishes on its Maps page (network, busway and
 * station/locality PDFs), by place, as that page lists them. Searchable, so a
 * rider can type a station or town instead of opening each region.
 */
export function TransitMapsDirectory() {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const regions = useMemo(() => {
    if (!needle) return MAPS.regions
    return MAPS.regions
      .map((r) => {
        const placeHit = r.region.toLowerCase().includes(needle)
        const groups = r.groups
          .map((g) => ({ ...g, maps: placeHit ? g.maps : g.maps.filter((m) => m.label.toLowerCase().includes(needle)) }))
          .filter((g) => g.maps.length)
        return { ...r, groups }
      })
      .filter((r) => r.groups.length) as Region[]
  }, [needle])
  const total = MAPS.regions.reduce((n, r) => n + r.groups.reduce((k, g) => k + g.maps.length, 0), 0)

  return (
    <div className="grid gap-2">
      <InputGroup size="sm">
        <InputGroup.Addon>
          <MagnifyingGlassIcon />
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Search maps" placeholder={`Search ${total} maps: town, station or busway`} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <InputGroup.Button variant="ghost" shape="square" aria-label="Clear" icon={<XIcon />} onClick={() => setQ('')} />}
      </InputGroup>
      {regions.length ? (
        <div className="divide-y divide-kumo-line overflow-hidden rounded-lg bg-kumo-base ring ring-kumo-line">
          {regions.map((r, i) => (
            <details key={r.region} open={!!needle || i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-kumo-tint [&::-webkit-details-marker]:hidden">
                <CaretRightIcon size={12} weight="bold" className="shrink-0 text-kumo-subtle transition-transform group-open:rotate-90" />
                <span className="flex-1 font-medium">{r.region}</span>
                <span className="text-xs text-kumo-subtle tabular-nums">{r.groups.reduce((k, g) => k + g.maps.length, 0)}</span>
              </summary>
              <div className="grid gap-3 px-3 pt-1 pb-3">
                {r.groups.map((g) => (
                  <div key={g.title} className="grid gap-1">
                    <Text size="xs" variant="secondary" bold>
                      {g.title}
                    </Text>
                    <ul className="flex flex-wrap gap-1.5">
                      {g.maps.map((m) => (
                        <li key={m.href}>
                          <a
                            href={m.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ring ring-kumo-line hover:bg-kumo-tint"
                          >
                            <FilePdfIcon size={14} className="text-kumo-subtle" />
                            {m.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Text size="sm" variant="secondary">
          No map matches “{q.trim()}”.
        </Text>
      )}
      <a
        href={MAPS.source}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline"
      >
        TransLink maps page <ArrowSquareOutIcon size={14} />
      </a>
    </div>
  )
}

/** "Station map (PDF)" for a stop page, when TransLink publishes a locality map for that station. */
export function StationMapLink({ name, stopId }: { name: string; stopId: string }) {
  const map = findStationMap(name, stopId)
  if (!map) return null
  return (
    <a href={map.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline">
      <FilePdfIcon size={14} /> Station map (PDF) <ArrowSquareOutIcon size={14} />
    </a>
  )
}
