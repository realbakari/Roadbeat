import { Badge, Button, Text } from '@cloudflare/kumo'
import { ArrowsInIcon, ArrowsOutIcon, CameraSlashIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { fetchCameraTime, isCameraImage } from '../api/cameraTime'
import type { Camera } from '../api/types'
import { clean, timeAgo } from '../lib/format'
import { cameraSrc, shortName } from '../lib/cameras'
import { ClampedText } from './ClampedText'

interface Props {
  camera: Camera
  now: number
  large: boolean
  onToggleSize: () => void
  onClose: () => void
  /** Opens the page for the locality the camera's owner files it under. */
  onOpenLocality?: (name: string) => void
}

/** Live camera view that sits on the map, pinned above the camera's location. */
export function CameraCard({ camera, now, large, onToggleSize, onClose, onOpenLocality }: Props) {
  const p = camera.properties
  const src = cameraSrc(camera, now)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  // The camera host's own time for the image, asked for again each time the image is reloaded (once a minute).
  const [publishedAt, setPublishedAt] = useState<number | null>(null)
  useEffect(() => {
    if (!isCameraImage(p.image_url)) return
    const c = new AbortController()
    fetchCameraTime(p.image_url, c.signal).then(setPublishedAt, () => {})
    return () => c.abort()
  }, [p.image_url, src])
  const note = clean(p.extra_info)
  const locality = p.locality

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
            {locality && onOpenLocality ? (
              <button type="button" onClick={() => onOpenLocality(locality)} className="hover:text-kumo-default hover:underline" title={`Everything at ${locality}`}>
                {locality}
              </button>
            ) : (
              locality
            )}
            {locality && p.direction && ' · '}
            {p.direction && `facing ${p.direction}`}
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
      <div className="grid min-w-0 gap-1 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Badge className="shrink-0" variant={camera.kind === 'floodcam' ? 'blue' : 'neutral'}>
            {camera.kind === 'floodcam' ? 'Flood camera' : 'Traffic camera'}
          </Badge>
          <span className="min-w-0 truncate text-xs text-kumo-subtle">
            {publishedAt ? `Image dated ${timeAgo(publishedAt, now)} by its host` : loadedAt ? `Fetched ${timeAgo(loadedAt, now)}` : 'Loading…'}
            {clean(p.image_sourced_from) && ` · ${clean(p.image_sourced_from)}`}
          </span>
        </div>
        <ClampedText className="text-xs text-kumo-subtle" text={`${note ?? 'The camera owner publishes no update interval.'} Roadbeat reloads the image every minute.`} />
      </div>
    </div>
  )
}
