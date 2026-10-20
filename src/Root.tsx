import { Loader } from '@cloudflare/kumo'
import { lazy, Suspense } from 'react'
import { App } from './App'
import { parsePath } from './lib/route'

// The dashboard, kiosk board, status page and timeline are separate screens, loaded only when opened.
const Dashboard = lazy(() => import('./dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))
const Kiosk = lazy(() => import('./dashboard/Kiosk').then((m) => ({ default: m.Kiosk })))
const StatusPage = lazy(() => import('./status/StatusPage').then((m) => ({ default: m.StatusPage })))
const TimelinePage = lazy(() => import('./timeline/TimelinePage').then((m) => ({ default: m.TimelinePage })))

/** Picks the screen for the current path: /dashboard, /status, /timeline[/<source>/<id>], /kiosk/<region>/<stop>, or the app. */
export function Root() {
  const screen = parsePath(location.pathname)
  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center bg-kumo-canvas" role="status">
          <Loader />
          <span className="sr-only">Loading…</span>
        </div>
      }
    >
      {screen.kind === 'dashboard' ? (
        <Dashboard />
      ) : screen.kind === 'status' ? (
        <StatusPage />
      ) : screen.kind === 'timeline' ? (
        <TimelinePage post={screen.post} />
      ) : screen.kind === 'kiosk' ? (
        <Kiosk region={screen.region} stopId={screen.stopId} />
      ) : (
        <App />
      )}
    </Suspense>
  )
}
