// The web app manifest.
import { SITE } from './settings.ts'

export function manifest() {
  return JSON.stringify(
    {
      name: `${SITE.name}: ${SITE.tagline}`,
      id: '/',
      short_name: SITE.name,
      description: 'Live Queensland road conditions, cameras, public transport, timetables and bushfire warnings from official sources.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: SITE.themeColor,
      lang: 'en-AU',
      categories: ['travel', 'navigation', 'utilities'],
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  )
}
