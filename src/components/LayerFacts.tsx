import type { ReactNode } from 'react'

/**
 * A time-based layer's publisher, how often it updates and its latest data
 * time, at the top of its note in the layers panel. `latest` is null while
 * nothing has been read yet.
 */
export function LayerFacts({ publisher, cadence, latest, latestLabel = 'Latest' }: { publisher: ReactNode; cadence: string; latest: string | null; latestLabel?: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
      <dt className="text-kumo-subtle">From</dt>
      <dd>{publisher}</dd>
      <dt className="text-kumo-subtle">Updates</dt>
      <dd>{cadence}</dd>
      <dt className="text-kumo-subtle">{latestLabel}</dt>
      <dd className="tabular-nums">{latest ?? 'Checking…'}</dd>
    </dl>
  )
}
