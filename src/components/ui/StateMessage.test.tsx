// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { RelativeTime } from './RelativeTime'
import { LoadFailed, NoResults } from './StateMessage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(node: React.ReactNode) {
  const el = document.createElement('div')
  act(() => createRoot(el).render(node))
  return el
}

describe('LoadFailed', () => {
  it('says Failed, names the source and its cause, and offers a retry', () => {
    const el = render(<LoadFailed what="road events" source="QLDTraffic" cause="QLDTraffic responded with 503." onRetry={() => {}} retriesItself />)
    expect(el.querySelector('[role="alert"]')).not.toBeNull()
    expect(el.textContent).toContain('Failed to load road events')
    expect(el.textContent).toContain("QLDTraffic didn't answer (QLDTraffic responded with 503). Roadbeat tries again by itself.")
    expect(el.querySelector('button')?.textContent).toContain('Try again now')
  })
})

describe('NoResults', () => {
  it('repeats the search that matched nothing', () => {
    const el = render(<NoResults what="road events" query="  Gympie " onClear={() => {}} />)
    expect(el.textContent).toContain('No road events match “Gympie”')
    expect(el.querySelector('button')?.textContent).toBe('Clear search and filters')
  })

  it('names the filters when there is no search text', () => {
    expect(render(<NoResults what="cameras" />).textContent).toContain('No cameras match these filters')
  })
})

describe('RelativeTime', () => {
  const now = Date.parse('2026-10-17T06:05:00Z')

  it('marks up the instant and gives screen readers the exact Brisbane time', () => {
    const el = render(<RelativeTime at={now - 3_600_000} now={now} inline />)
    const time = el.querySelector('time')!
    expect(time.getAttribute('datetime')).toBe('2026-10-17T05:05:00.000Z')
    expect(time.getAttribute('title')).toBe('Sat, 17 Oct, 3:05 pm AEST')
    expect(el.querySelector('.sr-only')?.textContent).toBe('1 hour ago, Sat, 17 Oct, 3:05 pm AEST')
  })

  it('takes keyboard focus outside links and buttons, and says when a time is unknown', () => {
    expect(render(<RelativeTime at={now} now={now} />).querySelector('time')?.getAttribute('tabindex')).toBe('0')
    expect(render(<RelativeTime at="nonsense" now={now} />).textContent).toBe('Unknown time')
  })
})
