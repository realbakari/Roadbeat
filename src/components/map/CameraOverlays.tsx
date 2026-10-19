import * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Camera } from '../../api/types'
import { cameraKey, type LngLat } from '../../lib/geo'
import { cameraSrc } from '../../lib/cameras'
import type { CrossingStatus } from '../../lib/crossings'
import { CameraCard } from '../CameraCard'

/** Zoom at which cameras in view show live thumbnails right on the map. */
const THUMB_ZOOM = 12
const MAX_THUMBS = 14
/** Gap between the pinned card's tip and the camera. */
const PIN_TIP = 18
/** Space above the pinned card, enough to clear the Layers button and zoom controls along the map's top. */
const PIN_MARGIN = 56

/** The selected camera's live view, anchored to its spot on the map. */
export function PinnedCamera({
  map,
  camera,
  now,
  onClose,
  onOpenLocality,
  crossing,
  onOpenEvent,
}: {
  map: maplibregl.Map
  camera: Camera
  now: number
  onClose: () => void
  onOpenLocality: (name: string) => void
  crossing: CrossingStatus | null
  onOpenEvent: (id: number) => void
}) {
  const [node] = useState(() => document.createElement('div'))
  const [large, setLarge] = useState(false)
  const [lng, lat] = camera.geometry.coordinates as LngLat

  useEffect(() => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: 'bottom',
      offset: PIN_TIP,
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

  // Keep the whole card in view. The card sits above the camera, so the camera moves down the
  // screen just far enough for the card's top to clear the map's top edge, while staying in view.
  // Measured after a frame, so the card has its size; `large` re-measures when it changes.
  // On a phone the map can be hidden behind the list when the camera opens (height 0), so the
  // card is placed again when the map next resizes, which is when the Map view appears.
  useEffect(() => {
    const place = () => {
      const h = map.getContainer().clientHeight
      if (!h) return
      // The popup element includes the tip below the card.
      const card = node.closest<HTMLElement>('.maplibregl-popup')?.offsetHeight ?? node.offsetHeight
      const offsetY = Math.max(0, Math.min(h / 2 - 48, card + PIN_TIP + PIN_MARGIN - h / 2))
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), offset: [0, offsetY], duration: 700 })
    }
    const raf = requestAnimationFrame(place)
    map.on('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      map.off('resize', place)
    }
  }, [map, node, lng, lat, large])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <CameraCard camera={camera} now={now} large={large} onToggleSize={() => setLarge((v) => !v)} onClose={onClose} onOpenLocality={onOpenLocality} crossing={crossing} onOpenEvent={onOpenEvent} />,
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

