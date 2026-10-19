import { Text } from '@cloudflare/kumo'
import { FIRE_BANS_PAGE, type FireBans } from '../api/fireBans'
import { BOM_CYCLONES, JTWC_PAGE, type Cyclone } from '../api/jtwc'
import { NSW_ALERT_COLOR, NSW_FIRES_ATTRIBUTION, NSW_FIRES_PAGE, type NswFire } from '../api/nswFires'
import { NSW_HAZARD_COLOR, NSW_HAZARDS_ATTRIBUTION, NSW_HAZARDS_PAGE, type NswHazard } from '../api/nswHazards'
import { IBTRACS_PAGE, type PastCyclone } from '../api/pastCyclones'
import type { Feed } from '../hooks/useHazardFeeds'
import { feedNotice } from '../lib/feedNotice'
import { InlineLink } from './ui/Links'
import { brisbaneClock as clock } from '../lib/aest'

/** Fire ban status under the bushfire warnings switch: QFD's own words, or why it couldn't be read. */
export function FireBansLine({ feed }: { feed: Feed<FireBans> }) {
  const notice = feedNotice('Fire bans', feed.data != null, feed.error, feed.fetchedAt)
  if (notice) return <Text size="xs" variant="error">{notice}</Text>
  if (!feed.data) return <Text size="xs" variant="secondary">Checking fire bans…</Text>
  const at = feed.data.feedUpdatedAt
  return (
    <Text size="xs" variant="secondary">
      {feed.data.none ? 'No current fire bans' : `${feed.data.bans.length} fire ${feed.data.bans.length === 1 ? 'ban' : 'bans'} listed above the road events`}, Queensland Fire
      Department{at ? `, updated ${clock.format(at)} AEST` : ''}. <InlineLink href={FIRE_BANS_PAGE}>Fire bans and restrictions</InlineLink>
    </Text>
  )
}

export function NswFiresNote({ feed }: { feed: Feed<NswFire[]> }) {
  const notice = feedNotice('NSW RFS incidents', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
        {Object.entries(NSW_ALERT_COLOR).map(([level, color]) => (
          <span key={level} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: color }} />
            {level}
          </span>
        ))}
      </div>
      {notice && <Text size="xs" variant="error">{notice}</Text>}
      <Text size="xs" variant="secondary">
        NSW Rural Fire Service major incidents north of 29.6° S, within about 150 km of the border, read every 2 minutes. {NSW_FIRES_ATTRIBUTION}, CC BY 4.0.{' '}
        <InlineLink href={NSW_FIRES_PAGE}>Fires Near Me</InlineLink>
      </Text>
    </div>
  )
}

export function NswHazardsNote({ feed }: { feed: Feed<NswHazard[]> }) {
  const notice = feedNotice('Transport for NSW hazards', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm" style={{ background: NSW_HAZARD_COLOR.normal }} />
          Incident, flood, roadwork or major event
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm" style={{ background: NSW_HAZARD_COLOR.major }} />
          Marked major
        </span>
      </div>
      {notice ? (
        <Text size="xs" variant="error">{notice}</Text>
      ) : (
        feed.data?.length === 0 && (
          <Text size="xs" variant="secondary">
            Transport for NSW lists no road hazards north of 29.6° S right now.
          </Text>
        )
      )}
      <Text size="xs" variant="secondary">
        Transport for NSW's Live Traffic hazards north of 29.6° S, within about 150 km of the border, as squares with dashed lines so they aren't mistaken for QLDTraffic's. Roadbeat's server reads them
        every minute. {NSW_HAZARDS_ATTRIBUTION}. <InlineLink href={NSW_HAZARDS_PAGE}>Live Traffic NSW</InlineLink>
      </Text>
    </div>
  )
}

export function CyclonesNote({ feed }: { feed: Feed<Cyclone[]> }) {
  const notice = feedNotice('JTWC cyclone warnings', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1">
      {notice ? (
        <Text size="xs" variant="error">{notice}</Text>
      ) : feed.data && !feed.data.length ? (
        <Text size="xs" variant="secondary">
          JTWC has no cyclone warnings near Australia{feed.fetchedAt ? ` (checked ${clock.format(feed.fetchedAt)} AEST)` : ''}.
        </Text>
      ) : null}
      <Text size="xs" variant="secondary">
        The US Joint Typhoon Warning Center's warning position and forecast track, every 30 minutes. Not the official Australian warning: follow the{' '}
        <InlineLink href={BOM_CYCLONES}>Bureau of Meteorology</InlineLink>. From <InlineLink href={JTWC_PAGE}>JTWC</InlineLink>.
      </Text>
    </div>
  )
}

export function PastCyclonesNote({ feed }: { feed: Feed<PastCyclone[]> }) {
  const notice = feedNotice('Past cyclone tracks', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1">
      {notice && <Text size="xs" variant="error">{notice}</Text>}
      <Text size="xs" variant="secondary">
        Tracks of tropical cyclones that came near Queensland since 1980, from positions agencies reported. History for context, not a warning; recent
        seasons are provisional. From NOAA NCEI's <InlineLink href={IBTRACS_PAGE}>IBTrACS</InlineLink>.
      </Text>
    </div>
  )
}
