import { MapPinIcon } from '@phosphor-icons/react'
import { NewTabNote } from '../NewTabNote'

/** Directions to a place in Google Maps, with its position. */
export function Directions({ at }: { at: [number, number] }) {
  const [lng, lat] = at
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-kumo-contrast px-3 text-sm text-kumo-inverse hover:opacity-90"
      >
        <MapPinIcon weight="fill" />
        Get directions
        <NewTabNote />
      </a>
      <span className="inline-flex items-center text-sm text-kumo-subtle tabular-nums">
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </span>
    </div>
  )
}
