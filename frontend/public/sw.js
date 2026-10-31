// Saathi service worker.
// 1) Makes the app installable. 2) Receives files shared from WhatsApp etc. (manifest share_target):
//    stores the file, then opens the app with ?shared=1 so Read mode reads it.
// Everything else goes straight to the network (no caching = no stale versions during the hackathon).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData()
        const file = form.get('file')
        if (file && typeof file !== 'string') {
          const cache = await caches.open('saathi-share')
          await cache.put('/shared-file', new Response(file, { headers: { 'content-type': file.type || 'application/octet-stream' } }))
        }
      } catch (err) { /* fall through to the app */ }
      return Response.redirect('/?shared=1', 303)
    })())
  }
})
