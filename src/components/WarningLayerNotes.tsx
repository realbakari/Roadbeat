import { Text } from '@cloudflare/kumo'
import { FIRE_COLOR, FIRE_LEVEL_LABEL, FIRE_LEVELS } from '../api/bushfires'
import { QLD_WARNINGS_PAGE, WARNING_COLOR, WARNING_LEVELS } from '../api/qldWarnings'
import { aestTime, aestWithAge } from '../lib/aest'
import { fireIcon, iconUrl } from '../lib/mapIcons'
import { LayerFacts } from './LayerFacts'
import { InlineLink } from './ui/Links'

function Key({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

interface FeedState {
  /** Why the feed is missing or stale, or null while it's fine. */
  notice: string | null
  /** When the app last read the feed. */
  fetchedAt: number | null
  now: number
}

/** The Queensland warnings layer's key, publisher, cadence and when it was last read, under its switch. */
export function WarningsNote({ count, notice, fetchedAt, now }: FeedState & { count: number | null }) {
  return (
    <div className="grid gap-1">
      <Key items={WARNING_LEVELS.map((l) => ({ label: l === 'Other' ? 'Other level' : l, color: WARNING_COLOR[l] }))} />
      <LayerFacts
        publisher={
          <InlineLink href={QLD_WARNINGS_PAGE}>Queensland Disaster Management</InlineLink>
        }
        cadence="Read every 2 minutes; the publisher says its map can be up to 5 minutes behind"
        latest={fetchedAt != null ? aestTime(fetchedAt, now) : null}
        latestLabel="Feed read"
      />
      {notice ? (
        <Text size="xs" variant="error">
          {notice}
        </Text>
      ) : (
        count === 0 && (
          <Text size="xs" variant="secondary">
            No current severe weather, flood or cyclone warnings.
          </Text>
        )
      )}
      <Text size="xs" variant="secondary">
        Storm, flood, cyclone and other hazard warnings issued under the Australian Warning System, with each warning's published area and level.
        Issue times are as each warning writes them, in Queensland time (AEST). CC BY 4.0, State of Queensland.
      </Text>
    </div>
  )
}

/** The bushfire layer's key, publisher, cadence and the newest time the feed published, under its switch. */
export function FiresNote({ newest, notice, fetchedAt, now }: FeedState & { newest: number | null }) {
  return (
    <div className="grid gap-1">
      <Key items={FIRE_LEVELS.map((l) => ({ label: FIRE_LEVEL_LABEL[l], color: FIRE_COLOR[l] }))} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
        <span className="inline-flex items-center gap-1">
          <img src={iconUrl(fireIcon('Advice'))} alt="" className="size-4" /> Fire
        </span>
        <span className="inline-flex items-center gap-1">
          <img src={iconUrl(fireIcon('Advice', 'FIRE PERMITTED BURN'))} alt="" className="size-4" /> Planned (permitted) burn, as the Queensland Fire Department lists it
        </span>
      </div>
      <LayerFacts
        publisher="Queensland Fire Department"
        cadence="Read every 2 minutes"
        latest={newest != null ? aestWithAge(newest, now) : fetchedAt != null ? 'No current incidents' : null}
        latestLabel="Last published"
      />
      {notice && (
        <Text size="xs" variant="error">
          {notice}
        </Text>
      )}
    </div>
  )
}
