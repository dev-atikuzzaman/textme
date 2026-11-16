const V = 'apon-v7'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin) return // Supabase, ফন্ট, মিডিয়া ক্যাশ হবে না
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put('/', c)); return res })
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
  const isCall = d.type === 'call'

  e.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const visible = list.filter((c) => c.visibilityState === 'visible')

    // অ্যাপ খোলা ও দেখা যাচ্ছে: সিস্টেম নোটিফিকেশনের বদলে অ্যাপের ভেতরে সাউন্ড বাজবে
    // (কলের রিং অ্যাপ নিজেই বাজায়, তাই কলে আলাদা ডিং নয়)
    if (visible.length > 0) {
      if (!isCall) visible.forEach((c) => c.postMessage({ type: 'PLAY_SOUND', payload: d }))
      return
    }

    // ব্যাকগ্রাউন্ডে চালু থাকা (hidden) ট্যাব/PWA-তেও অ্যাপের ডিং বাজাই
    list.forEach((c) => c.postMessage({ type: 'PLAY_SOUND', payload: d }))

    // অ্যাপ বন্ধ বা ব্যাকগ্রাউন্ডে: সাউন্ড/ভাইব্রেশনসহ সিস্টেম পপ-আপ
    const tag = d.tag || d.url || 'apon'
    const show = () => self.registration.showNotification(d.title || 'সুহৃদ', {
      body: d.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: d.url || '/notifications', type: d.type || '' },
      tag,
      renotify: true,   // একই tag-এ আবার এলেও সাউন্ড/ভাইব্রেশন হবে
      silent: false,
      requireInteraction: isCall, // কল নোটিফিকেশন নিজে থেকে মিলিয়ে যাবে না
      vibrate: isCall ? [600, 250, 600, 250, 600, 250, 600] : [200, 100, 200],
      actions: isCall ? [{ action: 'answer', title: '📞 ধরুন' }, { action: 'decline', title: 'কেটে দিন' }] : [],
    })
    await show()

    // কল: রিংয়ের মতো প্রতি ৪ সেকেন্ডে (সর্বোচ্চ ~28 সেকেন্ড) আবার সাউন্ড; ধরলে/কাটলে নোটিফিকেশন বন্ধ হলেই থামে
    if (isCall) {
      for (let i = 0; i < 7; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        const open = await self.registration.getNotifications({ tag })
        if (!open.length) break
        await show()
      }
    }
  })())
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.action === 'decline') return // কলার ৪৫ সেকেন্ড পর "ধরেনি" দেখবে
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((x) => 'focus' in x)
      if (c) return c.focus().then(() => ('navigate' in c ? c.navigate(url) : null))
      return clients.openWindow(url)
    })
  )
})
