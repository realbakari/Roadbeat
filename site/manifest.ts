// The web app manifest.
import { SITE } from './settings.ts'

/** The manifest, describing the app as the home page does (`description`). */
export function manifest(description: string) {
  return JSON.stringify(
    {
      name: `${SITE.name}: ${SITE.tagline}`,
      id: '/',
      short_name: SITE.name,
      description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      // One colour for the splash screen in both modes: the dark canvas, so dark-mode launches don't flash white.
      background_color: SITE.canvas.dark,
      theme_color: SITE.themeColor,
      lang: 'en-AU',
      categories: ['travel', 'navigation', 'utilities'],
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
      // Captures of the live app; scripts/build-icons.py says how to retake them.
      screenshots: [
        { src: '/screenshots/narrow.jpg', sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Current road events across Queensland, with filters by type' },
        { src: '/screenshots/wide.jpg', sizes: '1920x1080', type: 'image/jpeg', form_factor: 'wide', label: 'The live map of Queensland road events and bushfires beside the event list' },
      ],
    },
    null,
    2,
  )
}
