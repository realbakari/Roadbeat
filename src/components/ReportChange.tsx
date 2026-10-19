import { PhoneIcon } from '@phosphor-icons/react'
import { linkClass } from './ui/Links'

// Roadbeat shows what publishers publish and can't change it, so when
// someone sees something different, the useful thing is to tell the
// publisher: their correction then reaches everyone, in every app.

const WHO = {
  road: { name: 'Transport and Main Roads', phone: '13 19 40' },
  transit: { name: 'Translink', phone: '13 12 30' },
} as const

/**
 * "See something different?" with who to tell. For a road, `managersId` names
 * the "Who manages this road" section, so a council road's own contact is a
 * jump away. A fire is reported to Triple Zero instead.
 */
export function ReportChange({ about, managersId }: { about: 'road' | 'transit' | 'fire'; managersId?: string }) {
  if (about === 'fire')
    return (
      <p className="flex items-start gap-2 rounded-lg bg-kumo-recessed px-3 py-2.5 text-sm">
        <PhoneIcon size={16} className="mt-0.5 shrink-0 text-kumo-subtle" />
        <span>
          To report a fire, call{' '}
          <a href="tel:000" className={linkClass}>
            Triple Zero (000)
          </a>
          .
        </span>
      </p>
    )
  const who = WHO[about]
  return (
    <p className="flex items-start gap-2 rounded-lg bg-kumo-recessed px-3 py-2.5 text-sm">
      <PhoneIcon size={16} className="mt-0.5 shrink-0 text-kumo-subtle" />
      <span>
        See something different? Tell {who.name} on{' '}
        <a href={`tel:${who.phone.replace(/\s/g, '')}`} className={linkClass}>
          {who.phone}
        </a>
        {managersId && (
          <>
            , or{' '}
            {/* A button, not a #link: the app routes on the hash. */}
            <button type="button" onClick={() => document.getElementById(managersId)?.scrollIntoView({ behavior: 'smooth' })} className={linkClass}>
              the road's manager
            </button>
          </>
        )}
        . Roadbeat shows what they publish, so their correction reaches everyone.
      </span>
    </p>
  )
}
