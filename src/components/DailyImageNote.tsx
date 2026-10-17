import { Text } from '@cloudflare/kumo'
import { DAILY_PASSES, dailyLabel, GIBS_ABOUT, type DailyPass } from '../api/satelliteImagery'
import { LayerFacts } from './LayerFacts'
import { NewTabNote } from './NewTabNote'

const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const link = 'text-kumo-link underline decoration-1 underline-offset-2'

/** The first day each pass's image can be asked for: NOAA-20 from 2018, Terra from its first images in 2000. */
const FIRST_DAY: Record<DailyPass, string> = { noaa20: '2018-01-01', terra: '2000-02-24' }
const PASS_TEXT: Record<DailyPass, { satellite: string; when: string }> = {
  noaa20: { satellite: 'the NOAA-20 satellite', when: 'early afternoon' },
  terra: { satellite: "NASA's Terra satellite", when: 'morning' },
}

export interface DailyState {
  date: string | null
  latest: string | null
  checking: boolean
  error: string | null
  today: string
  onPick: (date: string) => void
}

/** A daily pass's day picker, publisher, cadence and newest day. Daily images are named by date only: GIBS publishes no time for them. */
export function DailyImageNote({ pass, date, latest, checking, error, today, onPick }: DailyState & { pass: DailyPass }) {
  const t = PASS_TEXT[pass]
  const status = error
    ? `NASA's imagery is unavailable: ${error}.`
    : checking
      ? "Checking which day's image NASA has published…"
      : date
        ? `${dailyLabel(pass, date)}${date === latest ? ', the newest NASA has published' : ''}.`
        : "NASA hasn't published an image over Brisbane for the last four days."
  return (
    <>
      <LayerFacts
        publisher={`NASA GIBS, from ${t.satellite}`}
        cadence={`Once a day, from the ${t.when} pass`}
        latest={latest ? day.format(Date.parse(`${latest}T00:00:00Z`)) : checking ? null : 'None in the last four days'}
        latestLabel="Newest day"
      />
      <Text size="xs" variant={error ? 'error' : 'secondary'}>
        {status}
      </Text>
      <input
        type="date"
        aria-label={`Day of the ${DAILY_PASSES[pass].label} image`}
        value={date ?? ''}
        min={FIRST_DAY[pass]}
        max={latest ?? today}
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className="h-8 w-fit rounded-md bg-kumo-base px-2 text-sm text-kumo-default ring ring-kumo-line"
      />
      <Text size="xs" variant="secondary">
        One day's true-colour picture from {t.satellite}'s {t.when} pass, not a live view. Cloud hides the ground, and strips the satellite didn't
        cover that day are blank. Sharpest at regional zoom. From{' '}
        <a href={GIBS_ABOUT} target="_blank" rel="noopener" className={link}>
          NASA's Global Imagery Browse Services
          <NewTabNote />
        </a>
        .
      </Text>
    </>
  )
}
