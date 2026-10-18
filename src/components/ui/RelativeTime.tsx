import { Tooltip } from '@cloudflare/kumo'
import { useState } from 'react'
import { timeDetail } from '../../lib/relativeTime'

interface Props {
  at: string | number | null | undefined
  now: number
  /**
   * Inside a link, button or clickable card the time can't take focus of its
   * own, so it gives the exact time as a hover title and to screen readers only.
   */
  inline?: boolean
}

/**
 * "3 hours ago" that says when exactly: the Brisbane time shows on hover, on
 * keyboard focus and on tap, and screen readers hear both. A missing or
 * unreadable time reads "Unknown time".
 */
export function RelativeTime({ at, now, inline = false }: Props) {
  const [open, setOpen] = useState(false)
  const d = timeDetail(at, now)
  if (!d) return <span>Unknown time</span>
  const text = (
    <>
      <span aria-hidden>{d.label}</span>
      <span className="sr-only">{d.spoken}</span>
    </>
  )
  if (inline) {
    return (
      <time dateTime={d.iso} title={d.exact}>
        {text}
      </time>
    )
  }
  return (
    <Tooltip
      content={d.exact}
      open={open}
      onOpenChange={setOpen}
      render={
        // A tap toggles it, since touch screens have no hover.
        <time dateTime={d.iso} tabIndex={0} onClick={() => setOpen((v) => !v)} className="cursor-help underline decoration-dotted decoration-1 underline-offset-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-kumo-brand" />
      }
    >
      {text}
    </Tooltip>
  )
}
