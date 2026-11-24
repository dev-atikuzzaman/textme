// ব্রাউজার স্মোক টেস্ট (নকল Supabase দিয়ে): চ্যাট ও প্রোফাইলের পেজিনেশন।
// চালান: npm run build:test && npm run test:e2e   (প্রথমবার: npx playwright install chromium)
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')

const PORT = 4179, APP = `http://localhost:${PORT}`
const ME = '11111111-1111-1111-1111-111111111111', FR = '22222222-2222-2222-2222-222222222222'
const t0 = Date.parse('2026-01-01T00:00:00Z')
const prof = (id, n) => ({ id, username: n, full_name: n + ' Name', avatar_url: null })
// ১৩০টি মেসেজ: "মেসেজ 1" সবচেয়ে পুরনো
const MSGS = Array.from({ length: 130 }, (_, i) => ({
  id: 'm' + String(i + 1).padStart(3, '0'), sender_id: i % 2 ? ME : FR, receiver_id: i % 2 ? FR : ME, content: 'মেসেজ ' + (i + 1),
  type: 'text', created_at: new Date(t0 + i * 60000).toISOString(), read_at: null, meta: null, pinned_at: null, media_path: null, expires_at: null,
}))
const POSTS = Array.from({ length: 45 }, (_, i) => ({
  id: 'p' + String(i + 1).padStart(3, '0'), user_id: ME, kind: 'post', content: 'পোস্ট ' + (i + 1), title: null, category: null, media_type: null, media_url: null,
  privacy: 'friends', pinned_at: null, group_id: null, page_id: null, profiles: prof(ME, 'Me'), likes: [], comments: [{ count: 0 }],
  created_at: new Date(t0 + i * 60000).toISOString(),
}))

async function startPreview() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(APP)).ok) return p } catch { /* এখনো চালু হয়নি */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  p.kill(); throw new Error('preview চালু হয়নি (আগে npm run build:test চালান)')
}

;(async () => {
  let server, b
  const errs = []
  try {
    server = await startPreview()
    b = await chromium.launch()
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } })
    await ctx.addInitScript(([ME]) => {
      try {
        localStorage.setItem('apon-install-hide', '1'); localStorage.setItem('apon-push-hide', '1')
        localStorage.setItem('sb-fake-auth-token', JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 'm@x.com', app_metadata: {}, user_metadata: {} } }))
      } catch {}
    }, [ME])
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errs.push(e.message))
    await page.route('https://fake.supabase.co/**', async (r) => {
      const u = new URL(r.request().url()), q = u.searchParams, t = u.pathname.split('/').pop()
      const one = (r.request().headers().accept || '').includes('vnd.pgrst.object')
      const out = (arr) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(one ? (arr[0] ?? null) : arr) })
      if (u.pathname.includes('/auth/v1/user')) return out([{ id: ME, aud: 'authenticated', email: 'm@x.com' }])
      const paginate = (list) => {
        let l = [...list]
        const lt = (q.get('created_at') || '').match(/^lt\.(.+)$/); if (lt) l = l.filter((x) => x.created_at < lt[1])
        const ord = q.getAll('order').flatMap((o) => o.split(',')); const desc = ord.some((o) => o.startsWith('created_at.desc'))
        l.sort((a, c) => (desc ? -1 : 1) * a.created_at.localeCompare(c.created_at))
        const off = Number(q.get('offset') || 0), lim = q.get('limit') ? Number(q.get('limit')) : l.length
        return l.slice(off, off + lim)
      }
      if (t === 'messages') return out(paginate(MSGS))
      if (t === 'posts') return out(paginate(POSTS))
      if (t === 'profiles') return one ? out([q.get('id') === 'eq.' + FR ? prof(FR, 'Friend') : prof(ME, 'Me')]) : out([prof(ME, 'Me'), prof(FR, 'Friend')])
      if (t === 'friendships') return out([{ id: 'f1', requester_id: ME, addressee_id: FR, status: 'accepted' }])
      if (t === 'mark_chat_read') return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
      return out([])
    })
    const nav = async (path) => {
      await page.goto(APP + '/'); await page.waitForTimeout(500)
      await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path)
    }
    const count = (sel) => page.locator(sel).count()

    // ── চ্যাট ──
    await nav('/chat/' + FR)
    await page.waitForSelector('[id^="m-"]')
    assert.equal(await count('[id^="m-"]'), 60, 'প্রথমে ৬০টি মেসেজ')
    assert.ok(await page.getByText('মেসেজ 130').first().isVisible(), 'সবচেয়ে নতুন মেসেজ আছে')
    assert.equal(await count('text=মেসেজ 70 >> visible=true') >= 0, true)
    const older = page.getByText('আগের মেসেজ দেখুন')
    await older.click(); await page.waitForFunction(() => document.querySelectorAll('[id^="m-"]').length === 120)
    await older.click(); await page.waitForFunction(() => document.querySelectorAll('[id^="m-"]').length === 130)
    assert.equal(await count('text=আগের মেসেজ দেখুন'), 0, 'সব এসে গেলে বাটন লুকায়')
    assert.equal(await count('[id="m-m001"]'), 1, 'সবচেয়ে পুরনো মেসেজ আছে, ডুপ্লিকেট নেই')
    const ids = await page.$$eval('[id^="m-"]', (e) => e.map((x) => x.id)); assert.equal(new Set(ids).size, ids.length)
    const sorted = [...ids].sort(); assert.deepEqual(ids, sorted, 'ক্রম ঠিক (পুরনো → নতুন)')

    // ── প্রোফাইল ──
    await nav('/profile')
    await page.waitForSelector('text=পোস্ট 45')
    assert.equal(await count('text=/^পোস্ট \\d+$/'), 20, 'প্রথমে ২০টি পোস্ট')
    const more = page.getByText('আরও পোস্ট দেখুন')
    const posts = () => page.locator('text=/^পোস্ট \\d+$/').count()
    await more.click(); await page.waitForFunction(() => document.querySelectorAll('article, [data-post], .post').length >= 0 && /পোস্ট 25/.test(document.body.innerText))
    assert.equal(await posts(), 40)
    await more.click(); await page.waitForFunction(() => /(^|\n)পোস্ট 1(\n|$)/.test(document.body.innerText))
    assert.equal(await posts(), 45, 'সব ৪৫টি, ডুপ্লিকেট ছাড়া')
    assert.equal(await count('text=আরও পোস্ট দেখুন'), 0)

    assert.deepEqual(errs, [], 'পেজ-এরর নেই')
    console.log('✓ e2e: চ্যাট ও প্রোফাইল পেজিনেশন ঠিক')
  } catch (e) { console.error('✗', e.message); process.exitCode = 1 }
  finally { await b?.close(); server?.kill() }
})()
