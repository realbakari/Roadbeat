// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from '../lib/filters'
import { AppHeader } from './AppHeader'
import { DEFAULT_SETTINGS } from '../lib/alertRules'

// A client render, as in the browser: a closed menu's parts still mount there, which a server render skips.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom has no matchMedia; the install prompt in the header reads it on first render.
window.matchMedia ??= (query: string) =>
  ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList

type Props = React.ComponentProps<typeof AppHeader>

// The header once blanked the whole app in production: a Kumo menu label that
// only rendered once the visitor count arrived threw during render. Rendering
// with and without a count keeps both branches exercised.
function header(visitors: Props['visitors']) {
  const props: Props = {
    mode: 'light',
    onToggleMode: () => {},
    now: Date.now(),
    events: [],
    cameraCount: 0,
    firstLoad: false,
    panel: 'events',
    transitOpen: false,
    filters: DEFAULT_FILTERS,
    onShowEvents: () => {},
    onShowCameras: () => {},
    onHome: () => {},
    notifications: { items: [], unread: 0, markRead: () => {}, markAllRead: () => {}, clear: () => {} } as unknown as Props['notifications'],
    onOpenHref: () => {},
    onAlertSettings: () => {},
    alertSettings: DEFAULT_SETTINGS,
    onAlertSettingsChange: () => {},
    onFeedback: () => {},
    searchSources: { events: [], cameras: [], restAreas: [], dumpPoints: [], truckRestrictions: [], clearances: null, toilets: null, bays: null, meters: null, bikeStops: null, councilEvents: null, stories: null, centres: null, outages: null, airStations: null, gauges: null, fires: null, warnings: null, fuel: null, speedCameras: null },
    onOpenSearch: () => {},
    error: null,
    fetchedAt: Date.now(),
    loading: false,
    refreshing: false,
    onRefresh: () => {},
    panelExpanded: false,
    onTogglePanelExpanded: () => {},
    visitors,
  }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  let failure: unknown = null
  act(() => {
    root.render(<AppHeader {...props} />)
  })
  // Open the More menu: that's where the count's menu entry mounts.
  try {
    act(() => {
      host.querySelector<HTMLButtonElement>('[aria-label="More"]')?.click()
    })
  } catch (e) {
    failure = e
  }
  const html = document.body.innerHTML
  act(() => root.unmount())
  host.remove()
  if (failure) throw failure
  return html
}

describe('AppHeader', () => {
  it('renders without a visitor count', () => {
    expect(header(null)).toContain('Roadbeat')
  })

  it('renders the visitor count without throwing', () => {
    const html = header({ online: 14, today: 312, at: Date.now() })
    expect(html).toContain('14')
    expect(html).toContain('online')
    expect(html).toContain('312')
  })
})
