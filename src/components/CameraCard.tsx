import { Badge, Button, Text } from '@cloudflare/kumo'
import { ArrowsInIcon, ArrowsOutIcon, CameraSlashIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Camera } from '../api/types'
import { clean, timeAgo } from '../lib/format'
import { cameraSrc, shortName } from '../lib/cameras'


interface Props {
  camera: Camera
  now: number
  large: boolean
  onToggleSize: () => void
  onClose: () => void
}

/** Live camera view that sits on the map, pinned above the camera's location. */
export function CameraCard({ camera, now, large, onToggleSize, onClose }: Props) {
  const p = camera.properties
  const src = cameraSrc(camera, now)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)

  return (
    <div
      className={`overflow-hidden rounded-xl bg-kumo-base shadow-lg ring ring-kumo-line ${
        large ? 'w-[min(640px,calc(100vw-48px))]' : 'w-[min(320px,calc(100vw-48px))]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 py-2 pr-1.5 pl-3">
        <div className="grid min-w-0 gap-0.5">
          <Text bold truncate>
            {shortName(p.description)}
          </Text>
          <Text size="xs" variant="secondary" truncate>
            {[p.locality, p.direction && `facing ${p.direction}`].filter(Boolean).join(' · ')}
          </Text>
        </div>
        <div className="flex shrink-0">
          <Button
            size="xs"
            variant="ghost"
            shape="square"
            aria-label={large ? 'Smaller view' : 'Larger view'}
            icon={large ? <ArrowsInIcon /> : <ArrowsOutIcon />}
            onClick={onToggleSize}
          />
          <Button size="xs" variant="ghost" shape="square" aria-label="Close camera" icon={<XIcon />} onClick={onClose} />
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleSize}
        className="relative block aspect-[4/3] w-full cursor-zoom-in bg-kumo-recessed"
        aria-label={large ? 'Smaller view' : 'Larger view'}
      >
        {failedSrc === src ? (
          <span className="flex h-full flex-col items-center justify-center gap-1.5 text-kumo-subtle">
            <CameraSlashIcon size={28} />
            <span className="text-sm">Image unavailable right now</span>
          </span>
        ) : (
          <img
            src={src}
            alt={`Live view: ${p.description}`}
            onLoad={() => setLoadedAt(Date.now())}
            onError={() => setFailedSrc(src)}
            className="h-full w-full object-cover"
          />
        )}
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Badge variant={camera.kind === 'floodcam' ? 'blue' : 'neutral'}>
          {camera.kind === 'floodcam' ? 'Flood camera' : 'Traffic camera'}
        </Badge>
        <Text size="xs" variant="secondary" truncate>
          {loadedAt ? `Updated ${timeAgo(loadedAt, now)}` : 'Loading…'}
          {clean(p.image_sourced_from) && ` · ${clean(p.image_sourced_from)}`}
        </Text>
      </div>
    </div>
  )
}
