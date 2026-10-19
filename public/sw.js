// Roadbeat service worker: shows push alerts for a rider's commute (see api/push.ts),
// and keeps the last good copy of /roads, the text-only events page, for when
// the connection drops. That page prints the time QLDTraffic's events were read
// and says how old a saved copy is. Nothing else is cached, so the app itself
// never shows stale road or transport data.

const ROADS_CACHE = 'roadbeat-roads-v1'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname !== '/roads') return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        const copy = res.clone()
        event.waitUntil(caches.open(ROADS_CACHE).then((c) => c.put(event.request, copy)))
        return res
      })
      .catch(() =>
        caches
          .open(ROADS_CACHE)
          .then((c) => c.match(event.request).then((hit) => hit || c.match('/roads')))
          .then((hit) => hit || fetch(event.request)),
      ),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Roadbeat', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Roadbeat', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
