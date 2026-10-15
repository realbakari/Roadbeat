import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import type { LiveVehicle, TransitRegion, TripUpdate, TripUpdates, VehicleMode } from './transitTypes.js'

// Decoding for TransLink's GTFS-RT protobuf feeds. Pure and free of browser-only
// code, so the app (src/api/translink.ts) and the server functions in api/ share it.

export const rt = GtfsRealtimeBindings.transit_realtime
export type FeedMessage = ReturnType<typeof rt.FeedMessage.decode>
type Long = { toNumber(): number } | number | null | undefined

export const num = (v: Long) => (v == null ? null : typeof v === 'number' ? v : v.toNumber())

export function decodeFeed(bytes: Uint8Array): FeedMessage {
  return rt.FeedMessage.decode(bytes)
}

/** "402-4596" → "402"; Queensland Rail route ids are origin+destination codes like "BRCA". */
export function routeCode(routeId: string) {
  return routeId.replace(/-\d+$/, '')
}

/** What the vehicle parser needs to know about a route. */
export interface RouteLookup {
  (code: string, region: TransitRegion): { mode: VehicleMode; line?: string; long: string; color: string | null } | null
}

const STATUS = {
  [rt.VehiclePosition.VehicleStopStatus.STOPPED_AT]: 'stopped',
  [rt.VehiclePosition.VehicleStopStatus.INCOMING_AT]: 'arriving',
  [rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO]: 'moving',
} as Record<number, LiveVehicle['status']>

/** Vehicle positions from one region's VehiclePositions feed. */
export function parseVehicles(region: TransitRegion, f: FeedMessage, routeInfo: RouteLookup): LiveVehicle[] {
  const out: LiveVehicle[] = []
  for (const e of f.entity) {
    const v = e.vehicle
    const p = v?.position
    if (!v || !p || !p.latitude || !p.longitude) continue
    const routeId = v.trip?.routeId ?? ''
    const code = routeCode(routeId)
    const info = routeInfo(code, region)
    out.push({
      id: `${region}-${v.vehicle?.id ?? e.id}`,
      region,
      mode: info?.mode ?? 'bus',
      route: code || '?',
      routeId,
      tripId: v.trip?.tripId || null,
      lineName: info?.line ?? null,
      routeName: info?.long || null,
      color: info?.color ?? null,
      label: v.vehicle?.label || null,
      position: [p.longitude, p.latitude],
      bearing: p.bearing ?? null,
      status: v.currentStatus != null ? (STATUS[v.currentStatus] ?? null) : null,
      stopId: v.stopId || null,
      timestamp: (num(v.timestamp) ?? 0) * 1000,
    })
  }
  return out
}

const TRIP_REL: Record<number, TripUpdate['relationship']> = {
  [rt.TripDescriptor.ScheduleRelationship.SCHEDULED]: 'scheduled',
  [rt.TripDescriptor.ScheduleRelationship.ADDED]: 'added',
  [rt.TripDescriptor.ScheduleRelationship.UNSCHEDULED]: 'unscheduled',
  [rt.TripDescriptor.ScheduleRelationship.CANCELED]: 'cancelled',
  5: 'replacement',
  6: 'duplicated',
}

/** Real-time stop times from one region's TripUpdates feed. */
export function parseTripUpdates(region: TransitRegion, f: FeedMessage): TripUpdates {
  const out: TripUpdates = { at: {}, trips: [] }
  out.at[region] = (num(f.header?.timestamp) ?? 0) * 1000
  for (const e of f.entity) {
    const u = e.tripUpdate
    const tripId = u?.trip?.tripId
    if (!u || !tripId) continue
    const routeId = u.trip.routeId ?? ''
    out.trips.push({
      key: `${region}-${tripId}`,
      region,
      tripId,
      route: routeCode(routeId),
      routeId,
      relationship: TRIP_REL[u.trip.scheduleRelationship ?? 0] ?? 'scheduled',
      stops: (u.stopTimeUpdate ?? [])
        .filter((s) => s.stopId)
        .map((s) => {
          const ev = s.departure?.time != null ? s.departure : s.arrival
          const t = num(ev?.time)
          return {
            stopId: s.stopId!,
            sequence: s.stopSequence ?? null,
            time: t ? t * 1000 : null,
            arrivalOnly: s.departure?.time == null,
            delay: ev?.delay ?? null,
            skipped: s.scheduleRelationship === rt.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED,
          }
        }),
    })
  }
  return out
}
