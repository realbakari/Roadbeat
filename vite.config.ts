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

export default defineConfig(({ mode }) => {
  // SITE_URL and CONTACT_EMAIL feed the SEO and agent pages (see site/plugin.ts and docs/deploy.md).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), tailwindcss(), sitePages({ siteUrl: env.SITE_URL ?? '', contactEmail: env.CONTACT_EMAIL ?? '' })],
    server: { proxy: translinkProxy },
    preview: { proxy: translinkProxy },
  }
})
