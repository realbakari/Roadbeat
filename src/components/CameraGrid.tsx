import { Empty, InputGroup, Select, Tabs, Text } from '@cloudflare/kumo'
import { CameraSlashIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Camera } from '../api/types'
import { CAMERA_COLOR } from '../lib/eventMeta'
import { cameraKey } from '../lib/geo'
import { shortName } from '../lib/cameras'

export type CameraKindFilter = 'all' | 'webcam' | 'floodcam'

export function CameraThumb({
  camera,
  note,
  selected,
  onOpen,
}: {
  camera: Camera
  note?: string
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
      className={`group grid gap-1.5 rounded-lg p-1 text-left hover:bg-kumo-tint focus-visible:bg-kumo-tint focus-visible:outline-none ${
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
          {[p.locality, note].filter(Boolean).join(' · ')}
        </Text>
      </div>
    </button>
  )
}


interface Props {
  cameras: Camera[]
  selectedKey: string | null
  onOpen: (key: string) => void
}

export function CameraGrid({ cameras, selectedKey, onOpen }: Props) {
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
        {visible.length === 0 ? (
          <div className="py-12">
            <Empty
              size="sm"
              icon={<CameraSlashIcon size={32} className="text-kumo-inactive" />}
              title="No cameras found"
              description="Try another road, suburb or district."
            />
          </div>
        ) : (
          // Two columns in the side panel; more when the panel is full screen.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1">
            {visible.map((c) => (
              <CameraThumb key={cameraKey(c)} camera={c} selected={cameraKey(c) === selectedKey} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
