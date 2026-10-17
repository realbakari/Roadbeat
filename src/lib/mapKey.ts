import { HOTSPOT_AGES } from '../api/hotspots'
import { CYCLONE_COLOR } from '../api/jtwc'
import { NSW_ALERT_COLOR } from '../api/nswFires'
import { PAST_CYCLONE_COLOR } from '../api/pastCyclones'
import type { MapLayers } from '../components/map/settings'
import { EVENT_TYPES } from './eventMeta'
import { nswFireIcon, typeSlug } from './mapIcons'
import { AIR_RATINGS } from '../api/airQuality'

/** One row of the map key: a map icon (by its image id) or a coloured dot, and what it means. */
export type KeyItem = { label: string; icon: string } | { label: string; color: string }

export interface KeySection {
  title: string
  items: KeyItem[]
}

/**
 * What the map key lists: road events always (they're always on the map),
 * then a section for each switched-on layer that draws icons or coloured
 * dots, in the layers panel's order. Each label says what the source calls it.
 */
export function mapKeySections(layers: MapLayers): KeySection[] {
  const sections: KeySection[] = [
    {
      title: 'Road events (QLDTraffic)',
      items: [
        ...EVENT_TYPES.map((m) => ({ label: m.type, icon: `event-${typeSlug(m.type)}` })),
        { label: 'Road closed to all traffic', icon: 'closure-all' },
        { label: 'Road closed to through traffic', icon: 'closure-thru' },
        { label: 'Upcoming (outline)', icon: 'event-roadworks-future' },
      ],
    },
  ]
  const add = (on: boolean, title: string, items: KeyItem[]) => on && items.length && sections.push({ title, items })
  add(layers.fires, 'Bushfires (QFD)', [
    ...(['Emergency Warning', 'Watch and Act', 'Advice'] as const).map((l) => ({ label: l, icon: `fire-${l.toLowerCase().replace(/[^a-z]+/g, '-')}` })),
    { label: 'Fire reported', icon: 'fire-information' },
    { label: 'Planned burn', icon: 'fire-information-burn' },
  ])
  add(layers.hotspots, 'Satellite hotspots, heat seen (not confirmed fires)', HOTSPOT_AGES.map((a) => ({ label: a.label, color: a.color })))
  add(layers.nswFires, 'NSW fires near the border (NSW RFS)', Object.keys(NSW_ALERT_COLOR).map((label) => ({ label, icon: nswFireIcon(label) })))
  add(layers.cyclones, 'Tropical cyclones (JTWC, not the official warning)', [{ label: 'Warning position, and JTWC forecast points', color: CYCLONE_COLOR }])
  add(layers.pastCyclones, 'Past cyclone tracks (IBTrACS)', [{ label: 'Reported track, history only', color: PAST_CYCLONE_COLOR }])
  add(layers.councilCentres, 'Council centres (disaster dashboards)', [
    { label: 'Evacuation centre or place of refuge', icon: 'centre-shelter' },
    { label: 'Sandbag point', icon: 'centre-sandbag' },
    { label: 'Other council centre', icon: 'centre-other' },
  ])
  add(layers.outages, 'Outages and notices', [
    { label: 'Power outage (Energex)', icon: 'outage-energex' },
    { label: 'Council notice, such as water works', icon: 'outage-council' },
  ])
  add(layers.gauges, 'Gauges', [
    { label: 'Stream height gauge', icon: 'gauge-stream' },
    { label: 'Rain gauge', icon: 'gauge-rain' },
    { label: 'Faded: no recent reading', color: '#94a3b8' },
  ])
  add(layers.airQuality, 'Air quality, worst rating this hour', [...AIR_RATINGS.map((label, i) => ({ label, icon: `air-${i + 1}` })), { label: 'No rated reading', icon: 'air-0' }])
  add(layers.webcams || layers.floodcams, 'Cameras', [
    ...(layers.webcams ? [{ label: 'Traffic camera', icon: 'camera-webcam' }] : []),
    ...(layers.floodcams ? [{ label: 'Flood camera', icon: 'camera-floodcam' }] : []),
  ])
  add(layers.waze, 'Waze user reports', [
    { label: 'Crash reported by Waze users', icon: 'waze' },
    { label: 'Hazard reported by Waze users', icon: 'waze-hazard' },
  ])
  add(layers.trucks, 'Truck restrictions', [{ label: 'Heavy vehicles restricted', icon: 'truck-restriction' }])
  add(layers.restAreas || layers.dumpPoints, 'Places', [
    ...(layers.restAreas ? [{ label: 'Rest area', icon: 'rest-area' }, { label: 'Heavy vehicle rest area', icon: 'rest-area-hv' }] : []),
    ...(layers.dumpPoints ? [{ label: 'RV dump point', icon: 'dump-point' }] : []),
  ])
  return sections
}
