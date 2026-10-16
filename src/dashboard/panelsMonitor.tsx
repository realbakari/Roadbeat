import type { ReactNode } from 'react'
import { AIR_COLOR, AIR_RATINGS, type AirStation } from '../api/airQuality'
import { worstStations } from '../lib/dashboard'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import type { PanelId } from '../lib/dashboardLayout'
import { timeAgo } from '../lib/format'
import { OUTAGE_COLOR, outageFacts } from '../lib/outages'
import { EmptyNote, Row, Stat, Tile } from './Tile'

// Panels from the council disaster dashboards and the state's air quality feed.

export interface MonitorData {
  now: number
  outages: Outage[] | null
  centres: CouncilCentre[] | null
  airStations: AirStation[] | null
}

export const MONITOR_VIEWS: Partial<Record<PanelId, (d: MonitorData) => ReactNode>> = {
  'air-count': (d) => {
    const n = d.airStations ? worstStations(d.airStations).length : null
    return <Stat label="Air quality stations Fair or worse" value={n ?? '…'} tone={n ? AIR_COLOR[3] : undefined} />
  },

  outages: (d) => (
    <Tile title="Outages and council notices" source="Energex power outages and councils' own notices, as relayed by council disaster dashboards. Energex's south-east network only.">
      {d.outages?.length ? (
        <ul className="grid gap-1">
          {d.outages.slice(0, 7).map((o) => (
            <Row
              key={o.id}
              label={
                <span>
                  <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: OUTAGE_COLOR[o.source] }} aria-hidden />
                  {o.title}
                </span>
              }
              detail={`${o.type} · ${o.council.replace(/ Council$/, '')}`}
              value={<span className="text-kumo-subtle">{outageFacts(o)[0] ?? ''}</span>}
              href={`/#place/outage/${encodeURIComponent(o.id)}`}
            />
          ))}
        </ul>
      ) : (
        <EmptyNote>{d.outages ? 'No outages or notices listed.' : 'Loading council dashboards…'}</EmptyNote>
      )}
    </Tile>
  ),

  centres: (d) => (
    <Tile title="Council centres open" source="Evacuation centres, places of refuge and sandbag points councils list on their disaster dashboards, with each council's own status.">
      {d.centres?.length ? (
        <ul className="grid gap-1">
          {d.centres.slice(0, 7).map((c) => (
            <Row key={c.id} label={c.name} detail={`${c.type} · ${c.council.replace(/ Council$/, '')}`} value={<span className="text-kumo-subtle">{c.status ?? ''}</span>} href={`/#place/centre/${encodeURIComponent(c.id)}`} />
          ))}
        </ul>
      ) : (
        <EmptyNote>{d.centres ? 'No centres listed. Councils open them as needed.' : 'Loading council dashboards…'}</EmptyNote>
      )}
    </Tile>
  ),

  air: (d) => {
    const worst = d.airStations ? worstStations(d.airStations) : null
    const at = d.airStations?.[0]?.measuredAt
    return (
      <Tile title="Air quality" source={`Department of Environment, Tourism, Science and Innovation hourly readings, each station's worst rating as the department rates it${at ? `, for ${timeAgo(at, d.now)}` : ''}.`}>
        {d.airStations ? (
          worst?.length ? (
            <ul className="grid gap-1">
              {worst.slice(0, 7).map(({ station, rating }) => (
                <Row key={station.id} label={station.name} detail={station.region} value={<span style={{ color: AIR_COLOR[rating] }}>{AIR_RATINGS[rating - 1]}</span>} href={`/#place/air/${encodeURIComponent(station.id)}`} />
              ))}
            </ul>
          ) : (
            <EmptyNote>Every station is rated Good or Very good this hour ({d.airStations.length} stations).</EmptyNote>
          )
        ) : (
          <EmptyNote>Loading air quality…</EmptyNote>
        )}
      </Tile>
    )
  },
}
