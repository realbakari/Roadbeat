import { lazy, Suspense } from 'react'
import App from './App.tsx'
import { parsePath } from './lib/route'

// The dashboard and kiosk board are separate screens, loaded only when opened.
const Dashboard = lazy(() => import('./dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))
const Kiosk = lazy(() => import('./dashboard/Kiosk').then((m) => ({ default: m.Kiosk })))

/** Picks the screen for the current path: /dashboard, /kiosk/<region>/<stop>, or the app. */
export function Root() {
  const screen = parsePath(location.pathname)
  return (
    <Suspense>
      {screen.kind === 'dashboard' ? (
        <Dashboard />
      ) : screen.kind === 'kiosk' ? (
        <Kiosk region={screen.region} stopId={screen.stopId} />
      ) : (
        <App />
      )}
    </Suspense>
  )
}
