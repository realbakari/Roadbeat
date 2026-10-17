import { Button, Text } from '@cloudflare/kumo'
import { GlobeHemisphereEastIcon, XIcon } from '@phosphor-icons/react'
import type { SatelliteSuggestion as Suggestion } from '../../lib/satelliteSuggestion'

/** A small, dismissible prompt on the map to switch to the live satellite view, raised only by an official warning or a JTWC storm. */
export function SatelliteSuggestion({ suggestion, onShow, onDismiss }: { suggestion: Suggestion; onShow: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="flex max-w-80 items-start gap-2 rounded-xl bg-kumo-base p-2.5 shadow-md ring ring-kumo-line">
      <GlobeHemisphereEastIcon size={18} className="mt-0.5 shrink-0 text-kumo-subtle" aria-hidden />
      <div className="grid gap-2">
        <Text size="sm">{suggestion.text}</Text>
        <Button size="sm" variant="primary" className="w-fit" onClick={onShow}>
          Show satellite
        </Button>
      </div>
      <Button size="sm" variant="ghost" shape="square" aria-label="Dismiss" icon={<XIcon />} onClick={onDismiss} className="max-md:size-11" />
    </div>
  )
}
