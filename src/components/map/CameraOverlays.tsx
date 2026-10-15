import * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Camera } from '../../api/types'
import { cameraKey, type LngLat } from '../../lib/geo'
import { cameraSrc } from '../../lib/cameras'
import { CameraCard } from '../CameraCard'

/** Zoom at which cameras in view show live thumbnails right on the map. */
const THUMB_ZOOM = 12
const MAX_THUMBS = 14

/** The selected camera's live view, anchored to its spot on the map. */
export function PinnedCamera({
  map,
  camera,
  now,
  onClose,
}: {
  map: maplibregl.Map
  camera: Camera
  now: number
  onClose: () => void
}) {
  const [node] = useState(() => document.createElement('div'))
  const [large, setLarge] = useState(false)
  const [lng, lat] = camera.geometry.coordinates as LngLat

  useEffect(() => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: 'bottom',
      offset: 18,
      maxWidth: 'none',
      className: 'camera-pin',
      focusAfterOpen: false,
    })
      .setDOMContent(node)
      .setLngLat([lng, lat])
      .addTo(map)
    return () => {
      popup.remove()
    }
  }, [map, node, lng, lat])

  // Keep the whole card in view: centre slightly below the camera so the card above it fits.
  useEffect(() => {
    const h = map.getContainer().clientHeight
    map.easeTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 12),
      offset: [0, Math.min(180, h * 0.3)],
      duration: 700,
    })
    // `large` re-centres when the card changes size.
  }, [map, lng, lat, large])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <CameraCard camera={camera} now={now} large={large} onToggleSize={() => setLarge((v) => !v)} onClose={onClose} />,
    node,
  )
}

/** Live mini-views of the cameras in view once zoomed in, so the map itself shows the road. */
export function CameraThumbs({
  map,
  cameras,
  selectedKey,
  now,
  onSelect,
}: {
  map: maplibregl.Map
  cameras: Camera[]
  selectedKey: string | null
  now: number
  onSelect: (key: string) => void
}) {
  const [inView, setInView] = useState<Camera[]>([])

  useEffect(() => {
    const update = () => {
      if (map.getZoom() < THUMB_ZOOM) return setInView([])
      const b = map.getBounds()
      const c = map.getCenter()
      setInView(
        cameras
          .filter((cam) => b.contains(cam.geometry.coordinates as LngLat))
          .sort(
            (x, y) =>
              c.distanceTo(maplibregl.LngLat.convert(x.geometry.coordinates as LngLat)) -
              c.distanceTo(maplibregl.LngLat.convert(y.geometry.coordinates as LngLat)),
          )
          .slice(0, MAX_THUMBS),
      )
    }
    update()
    map.on('moveend', update)
    return () => {
      map.off('moveend', update)
    }
  }, [map, cameras])

  return (
    <>
      {inView
        .filter((c) => cameraKey(c) !== selectedKey)
        .map((c) => (
          <CameraThumbMarker key={cameraKey(c)} map={map} camera={c} now={now} onSelect={onSelect} />
        ))}
    </>
  )
}

function CameraThumbMarker({
  map,
  camera,
  now,
  onSelect,
}: {
  map: maplibregl.Map
  camera: Camera
  now: number
  onSelect: (key: string) => void
}) {
  const [node] = useState(() => document.createElement('div'))
  const [failed, setFailed] = useState(false)
  const key = cameraKey(camera)

  useEffect(() => {
    const marker = new maplibregl.Marker({ element: node, anchor: 'bottom', offset: [0, -14] })
      .setLngLat(camera.geometry.coordinates as LngLat)
      .addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, node, camera])

  if (failed) return null
  return createPortal(
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(key)
      }}
      title={camera.properties.description}
      className="block overflow-hidden rounded-md bg-kumo-base p-0.5 shadow-md ring ring-kumo-line hover:ring-2 hover:ring-kumo-brand"
    >
      <img
        src={cameraSrc(camera, now)}
        alt={camera.properties.description}
        loading="lazy"
        onError={() => setFailed(true)}
        className="block h-[60px] w-20 rounded-[4px] object-cover"
      />
    </button>,
    node,
  )
}

