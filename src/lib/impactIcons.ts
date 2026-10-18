// Which map icon a QLDTraffic road event gets, by the same rule as the
// QLDTraffic website's map: a Red Alert gets the red alert pin; otherwise an
// impact the site has its own pin for (a closure, a lane closure, a vehicle
// or mass restriction) replaces the event type's icon; otherwise the event
// type's icon. Roadbeat draws its own versions of those pins (src/lib/mapIcons.tsx).

/** The mass limits QLDTraffic publishes as "Subject to a 25 tonne GVM limit", each with its own pin. */
export const GVM_LIMITS = ['5', '10', '15', '25', '42.5', '46'] as const

/** The icon for an impact QLDTraffic gives its own pin, by its published wording, or null for one it doesn't. */
export function impactIconId(subtype: string | null | undefined): string | null {
  switch (subtype) {
    case 'Road closed to all traffic':
      return 'closure-all'
    case 'Road closed to through traffic':
      return 'closure-thru'
    case 'One lane closed':
    case 'Partial lane closures':
      return 'impact-lane'
    case 'Restricted to four wheel drive vehicles only':
      return 'impact-4wd'
    case 'Restricted to high clearance vehicles only':
      return 'impact-hcv'
    case 'Limited to 80% of legislative axle group limit':
      return 'impact-axle'
  }
  const gvm = subtype?.match(/^Subject to a ([\d.]+) tonne GVM limit$/)?.[1]
  return gvm && (GVM_LIMITS as readonly string[]).includes(gvm) ? `impact-gvm-${gvm}` : null
}

export const typeSlug = (type: string) => type.toLowerCase().replace(/\s+/g, '-')

/** The map icon for a road event: its priority first, then its impact, then its type. Upcoming events keep their type's outline. */
export function eventIconId(type: string, impactSubtype: string | null | undefined, upcoming: boolean, priority?: string | null): string {
  if (priority === 'Red Alert') return 'event-red-alert'
  if (upcoming) return `event-${typeSlug(type)}-future`
  return impactIconId(impactSubtype) ?? `event-${typeSlug(type)}`
}
