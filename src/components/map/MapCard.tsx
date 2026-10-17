import { Button, LinkButton } from '@cloudflare/kumo'
import { ArrowRightIcon, NavigationArrowIcon, XIcon } from '@phosphor-icons/react'
import * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MapCard as MapCardData } from '../../lib/mapCard'
import { NewTabNote } from '../NewTabNote'

/**
 * A short card pinned to the selected item on the map, for when the side panel
 * is hidden: title, a line or two of published facts, and buttons to open the
 * full details or get directions. MapLibre picks the side of the point with room.
 */
export function MapCard({ map, card, onDetails, onClose }: { map: maplibregl.Map; card: MapCardData; onDetails: () => void; onClose: () => void }) {
  const [node] = useState(() => document.createElement('div'))
  const [lng, lat] = card.position

  useEffect(() => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: 'none',
      className: 'map-card',
      focusAfterOpen: false,
    })
      .setDOMContent(node)
      .setLngLat([lng, lat])
      .addTo(map)
    return () => {
      popup.remove()
    }
    // A moving vehicle's card follows it: the position updates reposition the popup.
  }, [map, node, lng, lat])

  return createPortal(
    <div className="w-[min(300px,calc(100vw-48px))] overflow-hidden rounded-xl bg-kumo-base text-sm text-kumo-default shadow-md ring ring-kumo-line">
      {card.image && <img src={card.image} alt="" loading="lazy" className="h-[120px] w-full object-cover" />}
      <div className="flex items-start gap-3 py-2.5 pr-2 pl-3">
        <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: card.color }} aria-hidden />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 className="text-base leading-tight font-semibold text-kumo-strong">{card.title}</h2>
          {card.subtitle && <p className="text-kumo-subtle">{card.subtitle}</p>}
          {card.facts.map((f) => (
            <p key={f} className="pt-0.5 leading-snug">
              {f}
            </p>
          ))}
        </div>
        <Button variant="ghost" shape="square" size="sm" aria-label="Close" icon={<XIcon />} onClick={onClose} />
      </div>
      <div className="flex gap-2 border-t border-kumo-line px-3 py-2">
        <Button variant="primary" size="sm" icon={<ArrowRightIcon />} onClick={onDetails}>
          Details
        </Button>
        {card.directions !== false && (
        <LinkButton
          variant="secondary"
          size="sm"
          icon={<NavigationArrowIcon weight="fill" />}
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Directions
          <NewTabNote />
        </LinkButton>
        )}
      </div>
    </div>,
    node,
  )
}
