import { InputGroup, Select, Tabs, Text } from '@cloudflare/kumo'
import { CameraSlashIcon, MagnifyingGlassIcon, ProhibitIcon, WavesIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Camera, TrafficEvent } from '../api/types'
import { CROSSING_KM, crossingNote, crossingStatuses, type CrossingStatus } from '../lib/crossings'
import { CAMERA_COLOR } from '../lib/eventMeta'
import { cameraKey } from '../lib/geo'
import { shortName } from '../lib/cameras'
import { NoResults } from './ui/StateMessage'

export type CameraKindFilter = 'all' | 'webcam' | 'floodcam'

export function CameraThumb({
  camera,
  note,
  crossing,
  selected,
  onOpen,
}: {
  camera: Camera
  note?: string
  /** For a flood camera, what QLDTraffic lists at its crossing, once road events have loaded. */
  crossing?: CrossingStatus
  selected?: boolean
  onOpen: (key: string) => void
}) {
  const p = camera.properties
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onOpen(cameraKey(camera))}
      aria-pressed={selected}
      className={`group grid gap-1.5 rounded-lg p-1 text-left hover:bg-kumo-tint focus-visible:bg-kumo-tint focus-visible:ring-2 focus-visible:ring-kumo-brand focus-visible:ring-offset-2 focus-visible:ring-offset-kumo-base focus-visible:outline-none ${
        selected ? 'bg-kumo-tint ring-2 ring-kumo-brand' : ''
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-kumo-recessed">
        {failed ? (
          <div className="flex h-full items-center justify-center text-kumo-inactive">
            <CameraSlashIcon size={24} />
          </div>
        ) : (
          <img
            src={p.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
        {camera.kind === 'floodcam' && (
          <span
            className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-xs text-white"
            style={{ backgroundColor: CAMERA_COLOR.floodcam }}
          >
            Flood
          </span>
        )}
      </div>
      <div className="grid gap-0.5 px-0.5 pb-0.5">
        <Text size="sm" bold truncate>
          {shortName(p.description)}
        </Text>
        <Text size="xs" variant="secondary" truncate>
          {/* Many flood cameras are named after their locality alone; don't repeat it. */}
          {[p.locality?.trim().toLowerCase() === shortName(p.description).trim().toLowerCase() ? null : p.locality, note]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {crossing && <CrossingLine s={crossing} />}
      </div>
    </button>
  )
}

/** A flood camera's crossing in words and shape: the closed sign, waves, or plain text when nothing is listed. */
function CrossingLine({ s }: { s: CrossingStatus }) {
  const closed = s.closures.length > 0
  const flooding = !closed && s.flooding.length > 0
  return (
    <span className={`flex items-center gap-1 text-xs ${closed ? 'font-medium text-kumo-danger' : flooding ? 'font-medium text-kumo-strong' : 'text-kumo-subtle'}`}>
      {closed && <ProhibitIcon size={12} weight="bold" className="shrink-0" aria-hidden />}
      {flooding && <WavesIcon size={12} weight="bold" className="shrink-0 text-kumo-info" aria-hidden />}
      <span className="truncate">{crossingNote(s)}</span>
    </span>
  )
}

interface Props {
  cameras: Camera[]
  selectedKey: string | null
  onOpen: (key: string) => void
  /** Road events, or null until they've loaded, when flood cameras say nothing about their crossings. */
  events: TrafficEvent[] | null
  now: number
}

export function CameraGrid({ cameras, selectedKey, onOpen, events, now }: Props) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<CameraKindFilter>('all')
  const [district, setDistrict] = useState('all')

  const districts = useMemo(
    () => [...new Set(cameras.map((c) => c.properties.district).filter(Boolean) as string[])].sort(),
    [cameras],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cameras
      .filter((c) => kind === 'all' || c.kind === kind)
      .filter((c) => district === 'all' || c.properties.district === district)
      .filter((c) => {
        if (!q) return true
        const p = c.properties
        const h = [p.description, p.locality, p.district, p.postcode].join(' ').toLowerCase()
        return q.split(/\s+/).every((t) => h.includes(t))
      })
      .sort((a, b) => a.properties.description.localeCompare(b.properties.description))
  }, [cameras, kind, district, query])

  // What QLDTraffic lists at each flood camera's crossing, keyed by camera.
  const crossings = useMemo(() => (events ? crossingStatuses(cameras, events, now, cameraKey) : new Map<string, CrossingStatus>()), [cameras, events, now])
  // Under Flood, crossings with a closure come first, then those with flooding listed.
  const shown = useMemo(() => {
    if (kind !== 'floodcam') return visible
    const rank = (c: Camera) => {
      const s = crossings.get(cameraKey(c))
      return s?.closures.length ? 0 : s?.flooding.length ? 1 : 2
    }
    return [...visible].sort((a, b) => rank(a) - rank(b))
  }, [kind, visible, crossings])
  const listed = [...crossings.values()].filter((s) => s.closures.length || s.flooding.length).length

  const counts = {
    all: cameras.length,
    webcam: cameras.filter((c) => c.kind === 'webcam').length,
    floodcam: cameras.filter((c) => c.kind === 'floodcam').length,
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-3 border-b border-kumo-line px-4 pt-3 pb-4">
        <InputGroup>
          <InputGroup.Addon>
            <MagnifyingGlassIcon />
          </InputGroup.Addon>
          <InputGroup.Input
            aria-label="Search cameras"
            placeholder="Search road or suburb"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <InputGroup.Button variant="ghost" shape="square" aria-label="Clear search" icon={<XIcon />} onClick={() => setQuery('')} />
          )}
        </InputGroup>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            size="sm"
            value={kind}
            onValueChange={(v) => setKind(v as CameraKindFilter)}
            tabs={[
              { value: 'all', label: `All ${counts.all}` },
              { value: 'webcam', label: `Traffic ${counts.webcam}` },
              { value: 'floodcam', label: `Flood ${counts.floodcam}` },
            ]}
          />
          <Select
            aria-label="District"
            size="sm"
            className="min-w-40"
            value={district}
            onValueChange={(v) => setDistrict((v as string) ?? 'all')}
            items={{ all: 'All districts', ...Object.fromEntries(districts.map((d) => [d, d])) }}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {kind === 'floodcam' && (
          <p className="px-1 pb-2 text-sm text-kumo-subtle">
            {events
              ? `QLDTraffic lists flooding or a road closure within ${CROSSING_KM} km of ${listed} of these ${counts.floodcam} flood cameras. A camera with nothing listed isn't a sign the road is open: check the image and the official event.`
              : 'Checking QLDTraffic for flooding and closures at each crossing…'}
          </p>
        )}
        {visible.length === 0 ? (
          <div className="-mx-3 -my-3">
            <NoResults
              what="cameras"
              query={query}
              hint="Search by road, suburb or district, or show all camera kinds."
              onClear={() => (setQuery(''), setKind('all'), setDistrict('all'))}
            />
          </div>
        ) : (
          // Two columns in the side panel; more when the panel is full screen.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
            {shown.map((c) => (
              <CameraThumb key={cameraKey(c)} camera={c} crossing={crossings.get(cameraKey(c))} selected={cameraKey(c) === selectedKey} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
