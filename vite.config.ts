import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { latestHeightsRequest, WMIP_SERVICE } from './src/api/qldGaugesFeed.ts'
import { sitePages } from './site/plugin.ts'

// TransLink's GTFS-RT feeds send no CORS headers, so the app reads them through
// /translink-rt. In dev/preview Vite proxies it; in production a Cloudflare Pages
// Function (functions/translink-rt) or the vercel.json rewrite does the same.
const translinkProxy = {
  '/translink-rt': {
    target: 'https://gtfsrt.api.translink.com.au',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/translink-rt/, '/api/realtime'),
  },
  // Queensland Fire Department bushfire warnings (no CORS headers either); functions/qfd-bushfires in production.
  '/qfd-bushfires': {
    target: 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com',
    changeOrigin: true,
    rewrite: () => '/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json',
  },
  // Queensland's severe weather, flood and cyclone warnings (no CORS headers either); functions/qld-warnings in production.
  '/qld-warnings': {
    target: 'https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com',
    changeOrigin: true,
    rewrite: () => '/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json',
  },
  // The state's live air quality feed (no CORS headers either); functions/air-quality in production.
  '/air-quality': {
    target: 'https://apps.des.qld.gov.au',
    changeOrigin: true,
    rewrite: () => '/air-quality/xml/feed.php?category=1&region=ALL',
  },
}

// Queensland's water monitoring portal sends no CORS headers and answers only a
// POST for the whole station network (about 20 s), so /qld-gauges is served by a
// small middleware here and by api/qld-gauges.ts or functions/qld-gauges.ts in production.
function qldGaugesProxy(): Plugin {
  let latest: { at: number; body: Promise<string> } | null = null
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] !== '/qld-gauges') return next()
    if (!latest || Date.now() - latest.at > 5 * 60_000) {
      const sites = (JSON.parse(readFileSync(new URL('./public/qld-gauges.json', import.meta.url), 'utf8')) as { stations: [string][] }).stations.map(([id]) => id)
      const body = fetch(WMIP_SERVICE, { method: 'POST', body: latestHeightsRequest(sites) }).then((r) => {
        if (!r.ok) throw new Error(`Water monitoring portal responded with ${r.status}`)
        return r.text()
      })
      latest = { at: Date.now(), body }
      body.catch(() => (latest = null))
    }
    latest.body.then(
      (text) => res.writeHead(200, { 'content-type': 'application/json' }).end(text),
      (e: Error) => res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message })),
    )
  }
  return {
    name: 'qld-gauges-proxy',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

// A Vercel function from api/ served in development: the module's handler for
// the request's method gets a Request for the same path and its Response is written back.
function devApi(path: string, module: string): Plugin {
  return {
    name: `dev-api:${path}`,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== path) return next()
        server
          .ssrLoadModule(module)
          .then((m) => {
            const handlers = m as Record<string, (r: Request) => Promise<Response>>
            const method = req.method ?? 'GET'
            return (handlers[method] ?? handlers.GET)(new Request(`http://localhost${req.url}`, { method }))
          })
          .then(async (r) => res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' }).end(await r.text()))
          .catch((e: Error) => res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message })))
      })
    },
  }
}

// The news monitor's feeds are read on the server (api/news.ts on Vercel). In
// development this middleware runs the same ingest, loaded through Vite, and
// keeps the result for 5 minutes. `npm run news:ingest` prints one run.
function newsDevApi(): Plugin {
  let latest: { at: number; body: Promise<string> } | null = null
  return {
    name: 'news-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/news') return next()
        if (!latest || Date.now() - latest.at > 5 * 60_000) {
          const body = server
            .ssrLoadModule('/api/_lib/newsIngest.ts')
            .then((m) => m.ingest(null))
            .then((snapshot) => JSON.stringify(snapshot))
          latest = { at: Date.now(), body }
          body.catch(() => (latest = null))
        }
        latest.body.then(
          (text) => res.writeHead(200, { 'content-type': 'application/json' }).end(text),
          (e: Error) => res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message })),
        )
      })
    },
  }
}

export default defineConfig(({ mode, command }) => {
  // SITE_URL, CONTACT_EMAIL and GA_MEASUREMENT_ID feed the SEO and agent pages (see site/plugin.ts and docs/deploy.md).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // On Vercel, fall back to the project's production address until SITE_URL is set.
  const siteUrl = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  // Analytics only in built sites, so local development doesn't count as visits.
  const gaMeasurementId = command === 'build' ? (env.GA_MEASUREMENT_ID ?? '') : ''
  return {
    plugins: [react(), tailwindcss(), qldGaugesProxy(), newsDevApi(), devApi('/api/camera-time', '/api/[endpoint].ts'), devApi('/api/history', '/api/[endpoint].ts'), devApi('/api/share', '/api/[endpoint].ts'), devApi('/api/visits', '/api/[endpoint].ts'), sitePages({ siteUrl, contactEmail: env.CONTACT_EMAIL ?? '', gaMeasurementId })],
    server: { proxy: translinkProxy },
    preview: { proxy: translinkProxy },
  }
})
