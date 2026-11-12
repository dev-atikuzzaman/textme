const V = 'apon-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin) return // Supabase, ফন্ট, মিডিয়া ক্যাশ হবে না
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put('/', c)); return res })
        .catch(() => caches.match('/'))
    )
    return
  }
  e.respondWith(
    caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)) }
      return res
    }))
  )
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then((l) => (l.length ? l[0].focus() : clients.openWindow('/notifications'))))
})
