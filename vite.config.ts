import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { latestHeightsRequest, WMIP_SERVICE } from './src/api/qldGaugesFeed.ts'
import { sitePages } from './site/plugin.ts'

// Six official feeds send no CORS headers, so the app reads them through its own
// paths: /translink-rt (TransLink's GTFS-RT), /qfd-bushfires, /qld-warnings,
// /qfd-firebans, /air-quality and /qld-gauges. In dev and preview Vite proxies the
// first five here (and qldGaugesProxy below serves /qld-gauges). In production on
// Vercel, rewrites in vercel.json do the same (and api/qld-gauges.ts for the
// gauges); on Cloudflare Pages, the functions of the same names in functions/.
const feedProxies = {
  '/translink-rt': {
    target: 'https://gtfsrt.api.translink.com.au',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/translink-rt/, '/api/realtime'),
  },
  // Queensland Fire Department bushfire warnings.
  '/qfd-bushfires': {
    target: 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com',
    changeOrigin: true,
    rewrite: () => '/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json',
  },
  // Queensland's severe weather, flood and cyclone warnings.
  '/qld-warnings': {
    target: 'https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com',
    changeOrigin: true,
    rewrite: () => '/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json',
  },
  // Queensland Fire Department fire bans.
  '/qfd-firebans': {
    target: 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com',
    changeOrigin: true,
    rewrite: () => '/content/Feeds/QLDFireban/FIREBAN.xml',
  },
  // The state's live air quality feed.
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

// The Vercel functions from api/ served in development: /api/push from
// api/push.ts, and every other /api/<name> from the router in api/[endpoint].ts
// (an unknown name gets its 404). /api/news has its own plugin below, which runs
// first. The module's handler for the request's method gets a Request for the
// same path and its Response is written back. `vite preview` has no module
// loader, so these answer only under `vite`.
function devApi(): Plugin {
  const moduleFor = (path: string) => {
    const name = /^\/api\/([a-z-]+)\/?$/.exec(path)?.[1]
    if (!name || name === 'news') return null
    return name === 'push' ? '/api/push.ts' : '/api/[endpoint].ts'
  }
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const module = moduleFor(req.url?.split('?')[0] ?? '')
        if (!module) return next()
        const method = req.method ?? 'GET'
        // POST and DELETE bodies (visits, feedback, push) are passed on as the deployed function would get them.
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () =>
          server
            .ssrLoadModule(module)
            .then((m) => {
              const handlers = m as Record<string, (r: Request) => Promise<Response>>
              const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks)
              return (handlers[method] ?? handlers.GET)(new Request(`http://localhost${req.url}`, { method, body, headers: { 'content-type': req.headers['content-type'] ?? '' } }))
            })
            .then(async (r) => res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' }).end(await r.text()))
            .catch((e: Error) => res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }))),
        )
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
  // The dev server's API routes read server settings (such as FPQ_API_TOKEN) from process.env, as on Vercel, so .env.local fills in any not already set.
  if (command === 'serve') for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v
  // On Vercel, fall back to the project's production address until SITE_URL is set.
  const siteUrl = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  // Analytics only in built sites, so local development doesn't count as visits.
  const gaMeasurementId = command === 'build' ? (env.GA_MEASUREMENT_ID ?? '') : ''
  return {
    plugins: [react(), tailwindcss(), qldGaugesProxy(), newsDevApi(), devApi(), sitePages({ siteUrl, contactEmail: env.CONTACT_EMAIL ?? '', gaMeasurementId })],
    server: { proxy: feedProxies },
    preview: { proxy: feedProxies },
  }
})
