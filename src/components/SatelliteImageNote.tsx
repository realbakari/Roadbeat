import { Radio, Text } from '@cloudflare/kumo'
import { GIBS_ACKNOWLEDGEMENT, himawariLabel, JMA_COPYRIGHT } from '../api/himawari'
import { JMA_CREDIT, type JmaFrame } from '../api/jmaHimawari'
import { aestWithAge } from '../lib/aest'
import { dailyPass, jmaProduct, SATELLITE_SOURCES, type SatelliteSource } from '../lib/satelliteImage'
import { DailyImageNote, type DailyState } from './DailyImageNote'
import { LayerFacts } from './LayerFacts'
import { NewTabNote } from './NewTabNote'

const link = 'text-kumo-link underline decoration-1 underline-offset-2'

interface Props extends DailyState {
  source: SatelliteSource
  onSource: (s: SatelliteSource) => void
  now: number
  /** The newest Himawari-9 image time GIBS lists, while a GIBS live image is chosen. */
  live: { time: string | null; error: string | null; checking: boolean }
  /** JMA's newest listed image, while a JMA image is chosen. */
  jma: { latest: JmaFrame | null; error: string | null; checking: boolean }
}

/** The satellite image layer's one choice of image (only one is drawn at a time), with its publisher, cadence and latest time. */
export function SatelliteImageNote(p: Props) {
  return (
    <div className="grid gap-1.5">
      <Radio legend="Satellite image to show" value={p.source} onValueChange={(v: SatelliteSource) => p.onSource(v)}>
        {SATELLITE_SOURCES.map((s) => (
          <Radio.Item key={s.value} value={s.value} label={s.label} />
        ))}
      </Radio>
      <SourceNote {...p} />
    </div>
  )
}

function SourceNote(p: Props) {
  const pass = dailyPass(p.source)
  if (pass) return <DailyImageNote {...p} pass={pass} />
  const product = jmaProduct(p.source)
  if (product) return <JmaNote {...p} truecolour={product === 'truecolour'} />
  return <LiveNote {...p} band={p.source === 'visible' ? 'visible' : 'infrared'} />
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

function JmaNote({ jma, now, truecolour }: Props & { truecolour: boolean }) {
  const status = jma.error
    ? `JMA's Himawari-9 imagery is unavailable${jma.latest ? ' to refresh' : ''}: ${jma.error}.`
    : !jma.checking && !jma.latest
      ? "JMA isn't listing any Himawari-9 images right now."
      : null
  return (
    <>
      <LayerFacts
        publisher="Japan Meteorological Agency (Himawari-9)"
        cadence="A new image every 10 minutes, listed a few minutes after it's taken"
        latest={jma.latest ? `Himawari-9 ${truecolour ? 'true colour' : 'infrared'}, ${aestWithAge(Date.parse(jma.latest.time), now)}` : jma.checking ? null : 'None listed'}
        latestLabel="Image"
      />
      {status && (
        <Text size="xs" variant={jma.error ? 'error' : 'secondary'}>
          {status}
        </Text>
      )}
      <Text size="xs" variant="secondary">
        {truecolour
          ? "JMA's true-colour picture of reflected sunlight, so it is dark at night in Queensland. Switch to infrared after sunset."
          : 'Infrared sees cloud day and night. Its shades show the temperature of cloud tops, not rain: for rain, use the rain radar.'}{' '}
        The whole Earth disc, so it only goes to state-wide zoom and blurs closer in. The time shown is the image's own, as JMA lists it. These are
        the images behind JMA's own weather map, which JMA can change without notice; NASA's live image is the fallback. {JMA_CREDIT}, under its{' '}
        <a href={JMA_COPYRIGHT} target="_blank" rel="noopener" className={link}>
          Public Data License
          <NewTabNote />
        </a>
        .
      </Text>
    </>
  )
}
