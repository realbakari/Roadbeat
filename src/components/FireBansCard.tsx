import { Text } from '@cloudflare/kumo'
import { ProhibitIcon } from '@phosphor-icons/react'
import { FIRE_BANS_PAGE, type FireBans } from '../api/fireBans'
import { brisbaneDayClock as when } from '../lib/aest'
import { ExternalLink } from './ui/Links'

/**
 * The Queensland Fire Department's current fire bans, above the road events,
 * each in QFD's own words. Shown only while QFD lists a ban; "No current fire
 * bans" lives in the bushfire layer's note instead.
 */
export function FireBansCard({ bans }: { bans: FireBans | null }) {
  if (!bans || bans.none || !bans.bans.length) return null
  return (
    <section className="mx-4 mt-3 grid gap-1.5 rounded-lg bg-kumo-danger-tint px-3 py-2 ring ring-kumo-line" aria-label="Fire bans">
      <Text size="sm" bold>
        <span className="inline-flex items-center gap-1.5 text-kumo-danger">
          <ProhibitIcon size={16} weight="bold" aria-hidden />
          {bans.bans.length === 1 ? 'Fire ban' : `${bans.bans.length} fire bans`}
        </span>
      </Text>
      <ul className="grid gap-1 text-sm">
        {bans.bans.map((b) => (
          <li key={b.id}>
            {b.text}
            {b.updatedAt && <span className="block text-xs text-kumo-subtle">Updated {when.format(b.updatedAt)} AEST</span>}
          </li>
        ))}
      </ul>
      <ExternalLink href={FIRE_BANS_PAGE}>Queensland Fire Department fire bans and restrictions</ExternalLink>
    </section>
  )
}
