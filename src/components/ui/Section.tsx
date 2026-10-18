import { Text } from '@cloudflare/kumo'
import type { ReactNode } from 'react'

/**
 * A titled section of a detail page. By default the body is one block under
 * the heading; `spaced` lays each child on the section's own gap instead,
 * as the transit pages do. `id` lets a link scroll to it.
 */
export function Section({ title, id, spaced, children }: { title: string; id?: string; spaced?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-4 gap-2">
      <Text as="h3" variant="heading">
        {title}
      </Text>
      {spaced ? children : <div>{children}</div>}
    </section>
  )
}
