import { Text } from '@cloudflare/kumo'
import type { ReactNode } from 'react'

/**
 * A titled section of a page. `hint` is a short line under the heading that
 * says what the section holds or where it comes from; `icon` sits before the
 * heading and `action` (a button or toggle) at the end of its row.
 *
 * By default the body is one block under the heading; `spaced` lays each
 * child on the section's own gap instead, as the transit pages do. `id` lets
 * a link scroll to it.
 */
export function Section({
  title,
  hint,
  icon,
  action,
  id,
  spaced,
  children,
}: {
  title: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  id?: string
  spaced?: boolean
  children: ReactNode
}) {
  let heading = (
    <Text as="h3" variant="heading">
      {title}
    </Text>
  )
  if (icon)
    heading = (
      <div className="flex items-center gap-2">
        {icon}
        {heading}
      </div>
    )
  if (action)
    heading = (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {heading}
        {action}
      </div>
    )
  return (
    <section id={id} className="grid scroll-mt-4 gap-2">
      {hint ? (
        <div className="grid gap-0.5">
          {heading}
          <Text size="sm" variant="secondary">
            {hint}
          </Text>
        </div>
      ) : (
        heading
      )}
      {spaced ? children : <div>{children}</div>}
    </section>
  )
}
