/**
 * Keyboard shortcuts past the header and the long list, shown only while
 * focused (the first Tab press reveals the first one). They move focus rather
 * than changing the URL hash, because the hash is the app's own router.
 */
export function SkipLinks() {
  const focusFirstIn = (selector: string) => {
    const host = document.querySelector<HTMLElement>(selector)
    const target = host?.matches(FOCUSABLE) ? host : host?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
  }
  return (
    <div className="contents">
      <SkipLink onClick={() => focusFirstIn('aside')}>Skip to the list</SkipLink>
      <SkipLink onClick={() => focusFirstIn('.maplibregl-canvas')}>Skip to the map</SkipLink>
    </div>
  )
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function SkipLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-kumo-base focus:px-3 focus:py-2 focus:text-sm focus:text-kumo-default focus:shadow-md focus:ring focus:ring-kumo-brand"
    >
      {children}
    </button>
  )
}
