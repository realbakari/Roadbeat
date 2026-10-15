import { Loader, Text } from '@cloudflare/kumo'
import { EnvelopeIcon, GlobeIcon, PhoneIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { fetchRoadContacts } from '../api/client'
import type { RoadContact } from '../api/types'
import type { LngLat } from '../lib/geo'

const ORDER: Record<string, number> = { local: 0, district: 1, state: 2 }

/** Who to contact about the road at a point (council, TMR district, statewide line). */
export function RoadContacts({ at }: { at: LngLat }) {
  const [contacts, setContacts] = useState<RoadContact[] | null>(null)
  const [lng, lat] = at

  useEffect(() => {
    const c = new AbortController()
    fetchRoadContacts(lng, lat, c.signal).then(
      (list) => setContacts([...list].sort((a, b) => (ORDER[a.contact_type] ?? 9) - (ORDER[b.contact_type] ?? 9))),
      () => !c.signal.aborted && setContacts([]),
    )
    return () => c.abort()
  }, [lng, lat])

  if (!contacts) return <Loader size="sm" />
  if (!contacts.length) return <Text variant="secondary">No contacts found for this location.</Text>

  return (
    <ul className="grid gap-2">
      {contacts.map((c) => (
        <li key={c.id} className="grid gap-1 rounded-lg bg-kumo-recessed px-3 py-2">
          <Text bold size="sm">
            {c.display_name}
          </Text>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {c.phone_number && (
              <a href={`tel:${c.phone_number.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-kumo-link hover:underline">
                <PhoneIcon /> {c.phone_number}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-kumo-link hover:underline">
                <EnvelopeIcon /> Email
              </a>
            )}
            {c.website && (
              <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-kumo-link hover:underline">
                <GlobeIcon /> Report online
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
