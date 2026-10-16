import { Text } from '@cloudflare/kumo'
import { HOTSPOT_AGES, HOTSPOT_HOURS, HOTSPOTS_ATTRIBUTION, HOTSPOTS_PORTAL } from '../api/hotspots'
import { GIBS_ABOUT } from '../api/satelliteImagery'
import { feedNotice } from '../lib/feedNotice'
import { NewTabNote } from './NewTabNote'

const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const link = 'text-kumo-link underline decoration-1 underline-offset-2'

/** The hotspot layer's key and caveats, under its switch. */
export function HotspotsNote({ hasData, error, fetchedAt }: { hasData: boolean; error: string | null; fetchedAt: number | null }) {
  const notice = feedNotice('Satellite hotspots', hasData, error, fetchedAt)
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
        {HOTSPOT_AGES.map((a) => (
          <span key={a.label} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: a.color }} />
            {a.label}
          </span>
        ))}
      </div>
      {notice && (
        <Text size="xs" variant="error">
          {notice}
        </Text>
      )}
      <Text size="xs" variant="secondary">
        Heat a satellite detected in the last {HOTSPOT_HOURS} hours, from Geoscience Australia's{' '}
        <a href={HOTSPOTS_PORTAL} target="_blank" rel="noopener" className={link}>
          DEA Hotspots
          <NewTabNote />
        </a>
        . A hotspot isn't a confirmed fire: it can be a bushfire, a planned burn or another heat source. Positions are within 375 m to 2 km, depending
        on the satellite. For warnings, follow the Queensland Fire Department. {HOTSPOTS_ATTRIBUTION}, CC BY 4.0.
      </Text>
    </div>
  )
}

interface ImageryProps {
  date: string | null
  latest: string | null
  checking: boolean
  error: string | null
  today: string
  onPick: (date: string) => void
}

/** The satellite image layer's day picker and caveats, under its switch. */
export function SatelliteImageNote({ date, latest, checking, error, today, onPick }: ImageryProps) {
  const status = error
    ? `NASA's imagery is unavailable: ${error}.`
    : checking
      ? "Checking which day's image NASA has published…"
      : date
        ? `Image for ${day.format(Date.parse(`${date}T00:00:00Z`))}${date === latest ? ', the newest NASA has published' : ''}.`
        : "NASA hasn't published an image over Brisbane for the last four days."
  return (
    <div className="grid gap-1.5">
      <Text size="xs" variant={error ? 'error' : 'secondary'}>
        {status}
      </Text>
      <input
        type="date"
        aria-label="Day of the satellite image"
        value={date ?? ''}
        min="2018-01-01"
        max={latest ?? today}
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className="h-8 w-fit rounded-md bg-kumo-base px-2 text-sm text-kumo-default ring ring-kumo-line"
      />
      <Text size="xs" variant="secondary">
        One day's true-colour picture from the NOAA-20 satellite's early afternoon pass, not a live view. Cloud hides the ground, and strips the
        satellite didn't cover that day are blank. Sharpest at regional zoom. From{' '}
        <a href={GIBS_ABOUT} target="_blank" rel="noopener" className={link}>
          NASA's Global Imagery Browse Services
          <NewTabNote />
        </a>
        .
      </Text>
    </div>
  )
}
