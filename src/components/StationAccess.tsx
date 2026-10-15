import { Badge, Banner, Text } from '@cloudflare/kumo'
import { ArrowSquareOutIcon, InfoIcon, SpeakerHighIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { fetchStationFacilities, STATION_FACILITIES_URL, type StationFacilities } from '../api/stationFacilities'
import type { TransitAlert } from '../api/translink'
import { LightMarkdown } from './LightMarkdown'

const QR = 'https://www.queenslandrail.com.au'

/**
 * Lift and escalator outages TransLink reports for a stop or its platforms. Shown
 * near the top of a stop page, because they decide whether someone can use it.
 */
export function AccessAlerts({ alerts }: { alerts: TransitAlert[] }) {
  if (!alerts.length) return null
  return (
    <div className="grid gap-2" role="region" aria-label="Lift and escalator outages">
      {alerts.map((a) => (
        <Banner
          key={a.id}
          variant="alert"
          size="sm"
          icon={<WarningIcon weight="fill" />}
          title={a.header}
          description={
            <span className="grid gap-1">
              {a.description && <span>{a.description}</span>}
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-kumo-link hover:underline">
                  More from TransLink <ArrowSquareOutIcon size={14} />
                </a>
              )}
            </span>
          }
        />
      ))}
    </div>
  )
}

/**
 * Queensland Rail's access and facilities details for a station, from Brisbane
 * City Council's open data. Renders nothing for stops that aren't Queensland Rail
 * stations in the dataset.
 */
export function StationFacilitiesSection({ stopId }: { stopId: string }) {
  // A failed fetch shows nothing; the rest of the stop page doesn't depend on it.
  const [state, setState] = useState<{ id: string; data: StationFacilities | null } | null>(null)
  useEffect(() => {
    let live = true
    fetchStationFacilities(stopId).then(
      (data) => live && setState({ id: stopId, data }),
      () => live && setState({ id: stopId, data: null }),
    )
    return () => {
      live = false
    }
  }, [stopId])
  const f = state?.id === stopId ? state.data : null
  if (!f) return null

  return (
    <section id="stop-access" className="grid scroll-mt-4 gap-3">
      <Text as="h3" variant="heading">
        Access and facilities
      </Text>

      {f.notice && (
        <Banner variant="secondary" size="sm" icon={<InfoIcon weight="fill" />} title="Queensland Rail notice" description={<LightMarkdown text={f.notice} base={QR} />} />
      )}

      <div className="grid gap-1.5">
        {f.accessZone && (
          <Text size="sm">
            <span className="font-medium">{f.accessZone}</span>
          </Text>
        )}
        {f.boarding && <LightMarkdown text={f.boarding} base={QR} />}
        {f.access.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {f.access.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {(f.other.length > 0 || f.carBays || f.bikeRacks > 0) && (
        <div className="grid gap-1.5">
          <Text size="xs" variant="secondary" bold>
            Facilities
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {f.other.map((label) => (
              <Badge key={label} variant="outline">
                {label === 'Car park' && f.carBays ? `Car park, ${f.carBays} spaces` : label}
              </Badge>
            ))}
            {f.bikeRacks > 0 && <Badge variant="outline">{f.bikeRacks} bike racks</Badge>}
          </div>
        </div>
      )}

      {f.hours && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-kumo-strong">Staffed hours</summary>
          <div className="pt-2">
            <LightMarkdown text={f.hours} base={QR} />
          </div>
        </details>
      )}

      {f.audio && (
        <div className="grid gap-1.5">
          <Text size="xs" variant="secondary" bold>
            <span className="inline-flex items-center gap-1.5">
              <SpeakerHighIcon size={14} aria-hidden /> Audio description of the station
            </span>
          </Text>
          {/* preload="none": the recordings are a few megabytes, so nothing downloads until someone presses play. */}
          <audio controls preload="none" src={f.audio} className="w-full" aria-label={`Audio description of ${f.name} station, from Queensland Rail`}>
            <a href={f.audio}>Download the audio description</a>
          </audio>
        </div>
      )}

      {f.description && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-kumo-strong">Station layout described</summary>
          <div className="pt-2">
            <LightMarkdown text={f.description} base={QR} />
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {f.guide && (
          <a href={f.guide} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline">
            Queensland Rail station map (PDF) <ArrowSquareOutIcon size={14} />
          </a>
        )}
      </div>
      <Text size="xs" variant="secondary">
        Queensland Rail station details, published by Brisbane City Council (
        <a href={STATION_FACILITIES_URL} target="_blank" rel="noreferrer" className="text-kumo-link hover:underline">
          Railway station facilities
        </a>
        , CC BY 4.0). Lift outages come from TransLink's real-time alerts.
      </Text>
    </section>
  )
}
