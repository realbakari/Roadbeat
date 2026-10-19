import { Button, Text } from '@cloudflare/kumo'
import { ListBulletsIcon, XIcon } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { iconUrl } from '../../lib/mapIcons'
import { mapKeySections } from '../../lib/mapKey'
import type { MapLayers } from './settings'

/**
 * The map's key: what each icon and colour on the map means, for road events
 * and every layer that's switched on. A button beside Layers opens it.
 */
export function MapKey({ layers }: { layers: MapLayers }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const sections = mapKeySections(layers)
  return (
    <div className="relative">
      <Button size="sm" icon={<ListBulletsIcon />} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="shadow-md">
        Key
      </Button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label="Map key"
          className="absolute top-full left-0 z-30 mt-2 grid max-h-[min(70vh,32rem)] w-72 max-w-[calc(100vw-1.5rem)] gap-3 overflow-y-auto rounded-lg bg-kumo-base p-3 shadow-lg ring ring-kumo-line"
        >
          <div className="flex items-center justify-between">
            <Text as="h2" variant="heading">
              Map key
            </Text>
            <Button size="sm" variant="ghost" shape="square" aria-label="Close map key" icon={<XIcon />} onClick={() => setOpen(false)} />
          </div>
          {sections.map((s) => (
            <section key={s.title} className="grid gap-1.5">
              <Text as="h3" size="xs" variant="secondary">
                {s.title}
              </Text>
              <ul className="grid gap-1">
                {s.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    {'icon' in item ? (
                      <img src={iconUrl(item.icon)} alt="" className="size-6 shrink-0" />
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
                        <span className="size-3 rounded-full ring-2 ring-white" style={{ background: item.color }} />
                      </span>
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Text size="xs" variant="secondary">
            Bigger road event icons are higher priority. Turn layers on and off under Layers. What the terms mean, from the agencies that publish them:{' '}
            <a href="/glossary/" className="underline">
              Glossary
            </a>
            .
          </Text>
        </div>
      )}
    </div>
  )
}
