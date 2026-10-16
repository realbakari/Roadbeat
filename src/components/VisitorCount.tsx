import { UsersThreeIcon } from '@phosphor-icons/react'
import type { Visitors } from '../api/visits'

const count = new Intl.NumberFormat('en-AU')

function visitorsTitle(v: Visitors): string {
  return `${count.format(v.online)} ${v.online === 1 ? 'person is' : 'people are'} using Roadbeat now (seen in the last 10 minutes) and ${count.format(v.today)} ${v.today === 1 ? 'has' : 'have'} today, Brisbane time. Counted without cookies; see the Privacy page.`
}

/** "14 online · 312 today": how many people are using Roadbeat, from the server's cookie-free count. */
export function VisitorCount({ visitors, className = '' }: { visitors: Visitors | null; className?: string }) {
  if (!visitors) return null
  return (
    <span className={`items-center gap-1.5 text-sm whitespace-nowrap text-kumo-subtle ${className}`} title={visitorsTitle(visitors)} aria-label={visitorsTitle(visitors)}>
      <UsersThreeIcon size={16} aria-hidden />
      <span className="tabular-nums">
        <span className="font-medium text-kumo-default">{count.format(visitors.online)}</span> online
        <span className="mx-1 text-kumo-inactive" aria-hidden>
          ·
        </span>
        <span className="font-medium text-kumo-default">{count.format(visitors.today)}</span> today
      </span>
    </span>
  )
}
