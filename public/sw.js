const V = 'apon-v12'
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
  // অডিও/ভিডিও (যেমন /notify.mp3) সরাসরি নেটওয়ার্ক থেকে: ক্যাশ করা পুরো-ফাইল রেসপন্স Range রিকোয়েস্টে
  // Safari/iPhone-এ সাউন্ড বাজতে দেয় না। তাই এগুলো SW ছুঁয়ে দেখবে না।
  if (r.destination === 'audio' || r.destination === 'video' || r.headers.has('range') || /\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(u.pathname)) return
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put('/', c)) } return res })
        .catch(async () => (await caches.match('/')) || new Response('ইন্টারনেট সংযোগ নেই — সংযোগ ফিরলে পেজটি আবার লোড করুন', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
    )
    return
  }
  e.respondWith(
    caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)) }
      return res
    }).catch(() => new Response('', { status: 504 })))
  )
})

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data.json() } catch { d = { body: e.data ? e.data.text() : '' } }
  const isCall = d.type === 'call'

  e.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    // শুধু দেখা যাচ্ছে + ফোকাসে থাকা উইন্ডোকেই "অ্যাপ খোলা" ধরি। অন্য উইন্ডো/অ্যাপে থাকলে (ডেস্কটপে) পপ-আপও দেখানো হবে
    const visible = list.filter((c) => c.visibilityState === 'visible' && c.focused !== false)

    // অ্যাপ খোলা ও ফোকাসে: সিস্টেম নোটিফিকেশনের বদলে অ্যাপের ভেতরে সাউন্ড বাজবে
    // (কলের রিং অ্যাপ নিজেই বাজায়, তাই কলে আলাদা ডিং নয়; টেস্ট পুশে সবসময় পপ-আপ দেখানো হয়)
    if (visible.length > 0 && d.type !== 'test') {
      if (!isCall) visible.forEach((c) => c.postMessage({ type: 'PLAY_SOUND', payload: d }))
      return
    }

    // ব্যাকগ্রাউন্ডে চালু থাকা (hidden) ট্যাব/PWA-তেও অ্যাপের ডিং বাজাই
    list.forEach((c) => c.postMessage({ type: 'PLAY_SOUND', payload: d }))

    // অ্যাপ বন্ধ বা ব্যাকগ্রাউন্ডে: সাউন্ড/ভাইব্রেশনসহ সিস্টেম পপ-আপ
    const tag = d.tag || d.url || 'apon'
    const show = () => self.registration.showNotification(d.title || 'বন্ধু', {
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
    try { self.navigator.setAppBadge?.()?.catch?.(() => {}) } catch { /* ignore */ } // অ্যাপ আইকনে ব্যাজ-ডট

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
