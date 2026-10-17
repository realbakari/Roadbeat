import { z } from 'zod'
import { firstSentence, plainText } from '../lib/newsText.js'

// Queensland council disaster dashboards on the QIT Plus platform: about 58 of
// the 78 councils on the state's list (src/data/council-dashboards.json). Each
// answers the same JSON under /dashboard/: imsBulletin for the council's
// written updates and imsEvac for the centres it has listed. They send no CORS
// headers, so only the server reads them.

/** The platform writes times as Microsoft JSON dates: "/Date(1792046378547)/". */
const MsDate = z
  .string()
  .regex(/^\/Date\(-?\d+\)\/$/)
  .transform((s) => Number(s.slice(6, -2)))

const Bulletins = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
        created: MsDate.nullable(),
        updated: MsDate.nullable(),
      }),
    }),
  ),
})

/** One update a council posted to its dashboard. The platform's ids repeat across bulletins, so none is kept. */
export interface CouncilBulletin {
  title: string
  /** The council's text as published: markup, to be cut down with firstSentence(). */
  description: string
  created: number
  updated: number | null
}

/** A dashboard's bulletins. Bulletins without a title or a created time are dropped. */
export function parseBulletins(json: unknown): CouncilBulletin[] {
  return Bulletins.parse(json).features.flatMap(({ properties: p }) => {
    const title = plainText(p.title ?? '')
    return title && p.created != null ? [{ title, description: p.description ?? '', created: p.created, updated: p.updated }] : []
  })
}

const Centres = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        buildingname: z.string().nullable(),
        buildingtype: z.string().nullable(),
        buildingaddress: z.string().nullable(),
        status: z.string().nullable(),
        note: z.string().nullable().optional(),
      }),
      geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }).nullable(),
    }),
  ),
})

/** A centre as a council lists it: an evacuation centre, place of refuge, sandbag station and so on. */
export interface CentreListing {
  name: string
  type: string
  address: string | null
  /** The council's own status text, such as "Open" or "Operational". */
  status: string | null
  note: string | null
  position: [number, number]
}

/** A dashboard's centres. Centres without a name, type or position are dropped. */
export function parseCentres(json: unknown): CentreListing[] {
  return Centres.parse(json).features.flatMap(({ properties: p, geometry }) => {
    const name = p.buildingname?.trim()
    const type = p.buildingtype?.trim()
    if (!name || !type || !geometry) return []
    return [{ name, type, address: p.buildingaddress?.trim() || null, status: p.status?.trim() || null, note: p.note?.trim() || null, position: geometry.coordinates }]
  })
}

/**
 * Councils with nothing to list answer an optional feed in their own ways:
 * `{"type":null,"features":null}` (Weipa's cameras) or a bare `[]`
 * (Cloncurry's notices). Both mean none, so read them as an empty list.
 */
const noneListed = (json: unknown) => (json == null || (Array.isArray(json) && json.length === 0) ? { features: [] } : json)
const orNone = <T>(list: T[] | null) => list ?? []

const Cameras = z.preprocess(
  noneListed,
  z.object({
    features: z.array(
      z.object({
        properties: z.object({
          id: z.number(),
          description: z.string().nullable(),
          direction: z.string().nullable().optional(),
          locality: z.string().nullable().optional(),
          image_url: z.string().nullable(),
          typeName: z.string().nullable().optional(),
          additional_detail: z.string().nullable().optional(),
        }),
        geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }).nullable(),
      }),
    )
      .nullable()
      .transform(orNone),
  }),
)

/** A camera as a council lists it: its description, the council's type for it, and the address of its latest image. */
export interface CameraListing {
  id: number
  description: string
  /** The council's own type, such as "Flood Camera" or "Traffic Cameras (check image date)". */
  type: string | null
  locality: string | null
  direction: string | null
  image: string
  /** The first sentence of the council's note on the camera: often how often its images update. */
  note: string | null
  position: [number, number]
}

/** A dashboard's cameras. Cameras without a description, an image address or a position are dropped. */
export function parseCameras(json: unknown): CameraListing[] {
  return Cameras.parse(json).features.flatMap(({ properties: p, geometry }) => {
    const description = p.description?.trim()
    const image = p.image_url?.trim()
    if (!description || !image || !geometry) return []
    return [{ id: p.id, description, type: p.typeName?.trim() || null, locality: p.locality?.trim() || null, direction: p.direction?.trim() || null, image, note: firstSentence(p.additional_detail ?? ''), position: geometry.coordinates }]
  })
}

const Iso = z.string().transform((s) => Date.parse(s))
const Shape = z.object({ type: z.enum(['Point', 'LineString', 'Polygon']), coordinates: z.unknown() })

const CouncilOutages = z.preprocess(
  noneListed,
  z.object({
    features: z.array(
      z.object({
        properties: z.object({
          id: z.number(),
          outage_type: z.string().nullable(),
          road_name: z.string().nullable(),
          start_date: Iso.nullable(),
          end_date: Iso.nullable(),
          updated_on: Iso.nullable(),
          responses: z.array(z.object({ key: z.string(), value: z.string().nullable() })).default([]),
        }),
        geometry: Shape.nullable(),
      }),
    )
      .nullable()
      .transform(orNone),
  }),
)

/**
 * A notice a council entered in its dashboard's outages widget: a water main
 * shutdown, a fuel outage, anything the council chooses, with its own type name.
 */
export interface CouncilNotice {
  id: number
  type: string
  title: string
  /** The council's "Short Description of Outage", or null. */
  details: string | null
  /** The council's "Incident" answer, usually "Planned" or "Unplanned". */
  incident: string | null
  start: number | null
  end: number | null
  updated: number | null
  geometry: GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon
}

const answer = (responses: { key: string; value: string | null }[], key: string) => responses.find((r) => r.key.trim() === key)?.value?.trim() || null
const ms = (t: number | null) => (t != null && Number.isFinite(t) ? t : null)

/** A dashboard's council-entered notices. Notices without a type, a title or a shape are dropped. */
export function parseCouncilNotices(json: unknown): CouncilNotice[] {
  return CouncilOutages.parse(json).features.flatMap(({ properties: p, geometry }) => {
    const type = p.outage_type?.trim()
    const title = p.road_name?.trim()
    if (!type || !title || !geometry) return []
    return [
      {
        id: p.id,
        type,
        title,
        details: answer(p.responses, 'Short Description of Outage'),
        incident: answer(p.responses, 'Incident'),
        start: ms(p.start_date),
        end: ms(p.end_date),
        updated: ms(p.updated_on),
        geometry: geometry as CouncilNotice['geometry'],
      },
    ]
  })
}

/** Energex writes restore times as ISO 8601 on some dashboards and as Microsoft JSON dates on others. */
const RestoreTime = z.union([MsDate, Iso])

const EnergexOutages = z.preprocess(
  (json) => json ?? [],
  z.array(
    z.object({
      Outage: z.object({
        event: z.string(),
        cause: z.string().nullable(),
        status: z.string().nullable(),
        council: z.string().nullable(),
        suburb: z.string().nullable(),
        customersAffected: z.coerce.number().nullable(),
        restoreTime: RestoreTime.nullable(),
        streets: z.array(z.string()).default([]),
      }),
    }),
  ),
)

/** An Energex power outage, as the dashboards relay it. Energex names the suburb and streets but gives no point. */
export interface PowerOutage {
  /** Energex's event id, the same on every dashboard that relays it. */
  event: string
  cause: string | null
  status: string | null
  /** The council area as Energex names it, which matches the gazetteer's council areas. */
  council: string | null
  /** The suburb as Energex writes it, in capitals. */
  suburb: string
  customers: number | null
  restore: number | null
  streets: string[]
}

/** The Energex outages a dashboard relays. Outages without a suburb are dropped. */
export function parseEnergexOutages(json: unknown): PowerOutage[] {
  return EnergexOutages.parse(json).flatMap(({ Outage: o }) => {
    const suburb = o.suburb?.trim()
    if (!suburb) return []
    return [{ event: o.event, cause: o.cause, status: o.status, council: o.council, suburb, customers: o.customersAffected, restore: ms(o.restoreTime), streets: o.streets }]
  })
}
