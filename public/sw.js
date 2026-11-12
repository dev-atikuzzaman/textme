const V = 'apon-v3'
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
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data.json() } catch { d = { body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'আপন', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: d.url || '/notifications' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((x) => 'focus' in x)
      if (c) return c.focus().then(() => ('navigate' in c ? c.navigate(url) : null))
      return clients.openWindow(url)
    })
  )
})
