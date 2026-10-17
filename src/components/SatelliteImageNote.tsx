import { Radio, Text } from '@cloudflare/kumo'
import { GIBS_ACKNOWLEDGEMENT, himawariLabel, JMA_COPYRIGHT } from '../api/himawari'
import { GIBS_ABOUT } from '../api/satelliteImagery'
import type { SatelliteSource } from '../hooks/useSatellite'
import { LayerFacts } from './LayerFacts'
import { NewTabNote } from './NewTabNote'

const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const link = 'text-kumo-link underline decoration-1 underline-offset-2'

const SOURCES: { value: SatelliteSource; label: string }[] = [
  { value: 'infrared', label: 'Live infrared (Himawari-9)' },
  { value: 'visible', label: 'Live visible, daytime only (Himawari-9)' },
  { value: 'daily', label: 'Daily true colour (NOAA-20)' },
]

interface Props {
  source: SatelliteSource
  onSource: (s: SatelliteSource) => void
  now: number
  /** The newest Himawari-9 image time GIBS lists, while a live image is chosen. */
  live: { time: string | null; error: string | null; checking: boolean }
  /** NASA's daily image: the day shown, the newest published, and the day picker. */
  date: string | null
  latest: string | null
  checking: boolean
  error: string | null
  today: string
  onPick: (date: string) => void
}

/** The satellite image layer's one choice of image (only one is drawn at a time), with its publisher, cadence and latest time. */
export function SatelliteImageNote(p: Props) {
  return (
    <div className="grid gap-1.5">
      <Radio legend="Satellite image to show" value={p.source} onValueChange={(v: SatelliteSource) => p.onSource(v)}>
        {SOURCES.map((s) => (
          <Radio.Item key={s.value} value={s.value} label={s.label} />
        ))}
      </Radio>
      {p.source === 'daily' ? <DailyNote {...p} /> : <LiveNote {...p} band={p.source} />}
    </div>
  )
}

function LiveNote({ band, live, now }: Props & { band: 'infrared' | 'visible' }) {
  const status = live.error
    ? `Himawari-9 imagery is unavailable${live.time ? ' to refresh' : ''}: ${live.error}.`
    : live.checking
      ? 'Checking the newest image NASA GIBS has published…'
      : live.time
        ? null
        : "NASA GIBS hasn't listed a Himawari-9 image in the last day."
  return (
    <>
      <LayerFacts
        publisher="Japan Meteorological Agency's Himawari-9, via NASA GIBS"
        cadence="A new image every 10 minutes, published a while after it's taken"
        latest={live.time ? himawariLabel(band, live.time, now) : live.checking ? null : 'None listed'}
        latestLabel="Image"
      />
      {status && (
        <Text size="xs" variant={live.error ? 'error' : 'secondary'}>
          {status}
        </Text>
      )}
      <Text size="xs" variant="secondary">
        {band === 'infrared'
          ? "Infrared sees cloud day and night. Its colours show the temperature of cloud tops, not rain: for rain, use the rain radar."
          : "Sunlight reflected off cloud, so it is dark at night in Queensland. Switch to infrared after sunset."}{' '}
        Coarse, about {band === 'visible' ? '1' : '2'} km a pixel, so it blurs when you zoom in. The time shown is the image's own,
        as NASA lists it. Imagery: Japan Meteorological Agency (
        <a href={JMA_COPYRIGHT} target="_blank" rel="noopener" className={link}>
          terms
          <NewTabNote />
        </a>
        ), made into map tiles by NASA. {GIBS_ACKNOWLEDGEMENT}
      </Text>
    </>
  )
}

function DailyNote({ date, latest, checking, error, today, onPick }: Props) {
  const status = error
    ? `NASA's imagery is unavailable: ${error}.`
    : checking
      ? "Checking which day's image NASA has published…"
      : date
        ? `Image for ${day.format(Date.parse(`${date}T00:00:00Z`))}${date === latest ? ', the newest NASA has published' : ''}.`
        : "NASA hasn't published an image over Brisbane for the last four days."
  return (
    <>
      <LayerFacts
        publisher="NASA GIBS, from the NOAA-20 satellite"
        cadence="Once a day, from the early afternoon pass"
        latest={latest ? day.format(Date.parse(`${latest}T00:00:00Z`)) : checking ? null : 'None in the last four days'}
        latestLabel="Newest day"
      />
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
    </>
  )
}
