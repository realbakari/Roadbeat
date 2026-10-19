import { Button, Loader, Text } from '@cloudflare/kumo'
import { EnvelopeIcon, GlobeIcon, PhoneIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { fetchRoadContacts } from '../api/client'
import type { RoadContact } from '../api/types'
import type { LngLat } from '../lib/geo'
import { ExternalLink, linkClass } from './ui/Links'

const ORDER: Record<string, number> = { local: 0, district: 1, state: 2 }

/** Who to contact about the road at a point (council, TMR district, statewide line). */
export function RoadContacts({ at }: { at: LngLat }) {
  const [contacts, setContacts] = useState<RoadContact[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [lng, lat] = at

  useEffect(() => {
    const c = new AbortController()
    fetchRoadContacts(lng, lat, c.signal).then(
      (list) => (setFailed(false), setContacts([...list].sort((a, b) => (ORDER[a.contact_type] ?? 9) - (ORDER[b.contact_type] ?? 9)))),
      () => !c.signal.aborted && setFailed(true),
    )
    return () => c.abort()
  }, [lng, lat, attempt])

  // A lookup that failed says so; it never reads as "no contacts".
  if (failed && !contacts)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Text variant="error">Couldn't load who manages this road: QLDTraffic's road lookup didn't answer.</Text>
        <Button size="xs" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    )
  if (!contacts) return <Loader size="sm" />
  if (!contacts.length) return <Text variant="secondary">QLDTraffic lists no contacts for this location.</Text>

  return (
    <ul className="grid gap-2">
      {contacts.map((c) => (
        <li key={c.id} className="grid gap-1 rounded-lg bg-kumo-recessed px-3 py-2">
          <Text bold size="sm">
            {c.display_name}
          </Text>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {c.phone_number && (
              <a href={`tel:${c.phone_number.replace(/\s/g, '')}`} className={`inline-flex items-center gap-1 ${linkClass}`}>
                <PhoneIcon /> {c.phone_number}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className={`inline-flex items-center gap-1 ${linkClass}`}>
                <EnvelopeIcon /> Email
              </a>
            )}
            {c.website && (
              <ExternalLink href={c.website} icon={<GlobeIcon />}>
                Report online
              </ExternalLink>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
