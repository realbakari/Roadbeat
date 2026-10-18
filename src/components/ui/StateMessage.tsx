import { Button, Text } from '@cloudflare/kumo'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { useState } from 'react'

// What a list says when it has nothing to show, placed where its first row
// would be. A failure says "Failed", names the source and its cause, and
// offers a retry that shows it's working, so a feed that didn't load never
// reads as "nothing reported".

interface FailedProps {
  /** What didn't load, as it reads in a sentence: "road events". */
  what: string
  /** Who was asked: "QLDTraffic". */
  source: string
  /** The error message, when there is one. */
  cause?: string | null
  /** Retries now; the button shows it's working until the promise settles. */
  onRetry?: () => unknown
  /** Set when the app already tries again by itself, said in the message. */
  retriesItself?: boolean
}

export function LoadFailed({ what, source, cause, onRetry, retriesItself }: FailedProps) {
  const [pending, setPending] = useState(false)
  const retry = async () => {
    setPending(true)
    try {
      await onRetry?.()
    } finally {
      setPending(false)
    }
  }
  return (
    <div role="alert" className="grid justify-items-start gap-2 px-4 py-4">
      <p className="m-0 flex items-center gap-2 font-semibold text-kumo-danger">
        <WarningCircleIcon size={18} weight="fill" aria-hidden />
        Failed to load {what}
      </p>
      <Text variant="secondary">
        {source} didn't answer{cause ? ` (${cause.replace(/\.$/, '')})` : ''}.{retriesItself ? ' Roadbeat tries again by itself.' : ''}
      </Text>
      {onRetry && (
        <Button size="sm" loading={pending} onClick={retry}>
          {pending ? 'Trying again' : 'Try again now'}
        </Button>
      )}
    </div>
  )
}

interface NoResultsProps {
  /** What was searched for, as it reads in a sentence: "road events". */
  what: string
  /** The search text, repeated so people see what matched nothing. */
  query?: string
  /** Clears the search and filters; the one action offered. */
  onClear?: () => void
  /** One line on what to try instead. */
  hint?: string
}

export function NoResults({ what, query, onClear, hint }: NoResultsProps) {
  const q = query?.trim()
  return (
    <div role="status" className="grid justify-items-start gap-2 px-4 py-4">
      <p className="m-0 font-semibold">{q ? `No ${what} match “${q}”` : `No ${what} match these filters`}</p>
      {hint && <Text variant="secondary">{hint}</Text>}
      {onClear && (
        <Button size="sm" onClick={onClear}>
          Clear search and filters
        </Button>
      )}
    </div>
  )
}
