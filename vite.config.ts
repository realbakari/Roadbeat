import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
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
}

export default defineConfig(({ mode, command }) => {
  // SITE_URL, CONTACT_EMAIL and GA_MEASUREMENT_ID feed the SEO and agent pages (see site/plugin.ts and docs/deploy.md).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // On Vercel, fall back to the project's production address until SITE_URL is set.
  const siteUrl = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  // Analytics only in built sites, so local development doesn't count as visits.
  const gaMeasurementId = command === 'build' ? (env.GA_MEASUREMENT_ID ?? '') : ''
  return {
    plugins: [react(), tailwindcss(), sitePages({ siteUrl, contactEmail: env.CONTACT_EMAIL ?? '', gaMeasurementId })],
    server: { proxy: translinkProxy },
    preview: { proxy: translinkProxy },
  }
})
