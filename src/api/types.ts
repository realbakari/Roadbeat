// Types for the QLDTraffic public API (API specification v1.10).
// Values the spec marks as "String" are frequently null in the live feed,
// so most fields are nullable here.

import type { Geometry, Point } from 'geojson'

export type EventType =
  | 'Hazard'
  | 'Crash'
  | 'Congestion'
  | 'Roadworks'
  | 'Special event'
  | 'Flooding'

export type EventPriority = 'Red Alert' | 'High' | 'Medium' | 'Low'

export interface Impact {
  direction: string | null
  towards: string | null
  impact_type: string | null
  impact_subtype: string | null
  delay: string | null
}

export interface Recurrence {
  event_id: number
  description: string | null
  impact: Impact | null
}

export interface Duration {
  start: string | null
  end: string | null
  active_days: string[] | null
  recurrences: Recurrence[] | null
}

export interface Source {
  source_name: string | null
  source_id: string | null
  account: string | null
  provided_by: string | null
  provided_by_url: string | null
}

export interface RoadSummary {
  road_name: string | null
  locality: string | null
  postcode: string | null
  local_government_area: string | null
  district: string | null
}

export interface EventProperties {
  id: number
  status: 'Published' | 'Reopened' | string
  published: string | null
  source: Source | null
  url: string
  event_type: EventType
  event_subtype: string | null
  event_due_to: string | null
  impact: Impact | null
  duration: Duration | null
  event_priority: EventPriority
  description: string | null
  advice: string | null
  information: string | null
  road_summary: RoadSummary | null
  last_updated: string | null
  next_inspection: string | null
  web_link: string | null
  area_alert?: boolean
  alert_message?: string | null
}

export interface Feature<G extends Geometry | null, P> {
  type: 'Feature'
  geometry: G
  properties: P
}

export interface FeatureCollection<G extends Geometry | null, P> {
  type: 'FeatureCollection'
  features: Feature<G, P>[]
  published?: string
  rights?: { owner: string; disclaimer: string; copyright: string }
}

export type TrafficEvent = Feature<Geometry | null, EventProperties>

export interface CameraProperties {
  id: number
  url: string
  description: string
  direction: string | null
  district: string | null
  locality: string | null
  postcode: string | null
  image_url: string
  image_sourced_from?: string | null
  isCustom?: boolean
  extra_info?: string | null
}

export type CameraKind = 'webcam' | 'floodcam'

export type Camera = Feature<Point, CameraProperties> & { kind: CameraKind }

export interface RestArea {
  id: string
  name: string | null
  /** Feed code, e.g. "RA", "RA HV", "HV", "DR" (see restAreaLabel). */
  type: string
  toilet: boolean
  accessibleToilet: boolean
  water: string | null
  carBays: boolean
  truckBays: string | null
  heavyVehicle: boolean
  coordinates: [number, number]
}

export interface DumpPoint {
  id: string
  name: string
  description: string
  coordinates: [number, number]
}

export type TruckRestriction = Feature<
  import('geojson').MultiLineString,
  {
    id: number
    name: string
    originterm: string
    destinationterm: string
    description: string
    suburbs: string
    roads: string
    moreinformation: string | null
  }
>

export interface WazeReport {
  uuid: string
  type: string
  subtype: string
  pubMillis: number
  reliability: number
  confidence: number
  nThumbsUp: number
  location: { x: number; y: number }
  street?: string
  city?: string
}

export interface RoadContact {
  id: number
  name: string
  display_name: string
  website: string | null
  email: string | null
  phone_number: string | null
  contact_type: 'local' | 'district' | 'state' | string
}

export type TransitMode = 'train' | 'bus' | 'ferry' | 'tram'

export interface TransitLine {
  mode: TransitMode
  name: string
  status: string
  link: string
  region: string | null
}

export interface TransitNotice {
  title: string
  link: string
  description: string
  upcoming: boolean
  severity: 'Major' | 'Minor' | 'Informative'
  region: string | null
}
