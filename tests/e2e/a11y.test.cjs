// অ্যাক্সেসিবিলিটি: axe-core দিয়ে মূল পেজ স্ক্যান (হালকা ও ডার্ক থিম) + ডায়ালগের কীবোর্ড আচরণ।
// চালান: npm run build:test && npm run test:a11y
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')

const PORT = 4178, APP = `http://localhost:${PORT}`
const ME = '11111111-1111-1111-1111-111111111111', FR = '22222222-2222-2222-2222-222222222222'
const t0 = Date.parse('2026-01-01T00:00:00Z'), iso = (m) => new Date(t0 + m * 60000).toISOString()
const prof = (id, n) => ({ id, username: n, full_name: n + ' Name', avatar_url: null })
const post = (o) => ({ kind: 'post', content: null, title: null, category: null, media_type: null, media_url: null, privacy: 'friends', pinned_at: null, group_id: null, page_id: null, profiles: prof(FR, 'Friend'), likes: [], comments: [{ count: 0 }], user_id: FR, ...o })
const POSTS = [
  post({ id: 'p1', content: 'সাধারণ পোস্ট', created_at: iso(5) }),
  post({ id: 'p2', category: 'note', title: 'আমার নোট', content: 'নোটের লেখা '.repeat(20), created_at: iso(4) }),
  post({ id: 'p3', content: 'ছবির পোস্ট', media_type: 'image', media_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', created_at: iso(3) }),
  post({ id: 'p4', content: 'আমার পোস্ট', user_id: ME, profiles: prof(ME, 'Me'), created_at: iso(2) }),
]
const MSGS = [
  { id: 'm1', sender_id: FR, receiver_id: ME, content: 'কেমন আছো?', type: 'text', created_at: iso(10), read_at: null, meta: null, pinned_at: null, media_path: null, expires_at: null },
  { id: 'm2', sender_id: ME, receiver_id: FR, content: 'ভালো', type: 'text', created_at: iso(11), read_at: null, meta: null, pinned_at: null, media_path: null, expires_at: null },
]
const GROUPS = [{ id: 'g1', name: 'পরিবার', about: 'আমাদের গ্রুপ', privacy: 'public', created_by: ME, avatar_url: null, created_at: iso(1) }]
const NOTIFS = [{ id: 'n1', user_id: ME, actor_id: FR, type: 'like', post_id: 'p4', read: false, created_at: iso(6), actor: prof(FR, 'Friend') }]

function startPreview() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  return (async () => {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) return p } catch {} await new Promise((r) => setTimeout(r, 500)) }
    p.kill(); throw new Error('preview চালু হয়নি (আগে npm run build:test চালান)')
  })()
}

// এই নিয়মগুলোতে ব্যর্থতা মানে টেস্ট ফেল। (color-contrast আলাদা: নিচে গণনা করে সীমা বেঁধে দেওয়া)
const RULES = ['button-name', 'image-alt', 'link-name', 'label', 'aria-valid-attr', 'aria-valid-attr-value', 'aria-required-attr', 'aria-allowed-attr', 'aria-roles', 'duplicate-id-aria', 'html-has-lang', 'document-title', 'meta-viewport', 'select-name', 'input-image-alt', 'aria-dialog-name', 'aria-hidden-focus']

;(async () => {
  let server, b; let failed = false
  try {
    server = await startPreview(); b = await chromium.launch()
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } })
    await ctx.addInitScript(([ME]) => { try {
      localStorage.setItem('apon-install-hide', '1'); localStorage.setItem('apon-push-hide', '1')
      localStorage.setItem('sb-fake-auth-token', JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 'm@x.com', app_metadata: {}, user_metadata: {} } }))
    } catch {} }, [ME])
    const page = await ctx.newPage(); const errs = []
    page.on('pageerror', (e) => errs.push(e.message))
    await page.route('https://fake.supabase.co/**', async (r) => {
      const u = new URL(r.request().url()), q = u.searchParams, t = u.pathname.split('/').pop()
      const one = (r.request().headers().accept || '').includes('vnd.pgrst.object')
      const out = (arr) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(one ? (arr[0] ?? null) : arr) })
      if (u.pathname.includes('/auth/v1/user')) return out([{ id: ME, aud: 'authenticated', email: 'm@x.com' }])
      if (t === 'posts') { const id = q.get('id'); return out(id?.startsWith('eq.') ? POSTS.filter((p) => p.id === id.slice(3)) : q.get('user_id') === 'eq.' + ME ? POSTS.filter((p) => p.user_id === ME) : POSTS) }
      if (t === 'messages') return out(MSGS)
      if (t === 'profiles') return one ? out([q.get('id') === 'eq.' + FR ? prof(FR, 'Friend') : prof(ME, 'Me')]) : out([prof(ME, 'Me'), prof(FR, 'Friend')])
      if (t === 'friendships') return out([{ id: 'f1', requester_id: ME, addressee_id: FR, status: 'accepted' }])
      if (t === 'groups') return out(GROUPS)
      if (t === 'notifications') return out(NOTIFS)
      return out([])
    })
    const go = async (path) => {
      await page.goto(APP + '/'); await page.waitForTimeout(400)
      await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path)
      await page.waitForTimeout(1300)
    }
    const axe = async () => {
      await page.addScriptTag({ path: require.resolve('axe-core') })
      return page.evaluate(async (rules) => {
        const r = await axe.run(document, { runOnly: { type: 'rule', values: [...rules, 'color-contrast'] } })
        return r.violations.map((v) => ({ id: v.id, n: v.nodes.length, impact: v.impact, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.any[0]?.message || n.failureSummary || '').slice(0, 120)) }))
      }, RULES)
    }

    const PAGES = ['/', '/messages', '/chat/' + FR, '/profile', '/groups', '/friends', '/notifications', '/search', '/videos']
    let contrast = 0; const report = []
    for (const theme of ['light', 'dark']) {
      await page.addInitScript((t) => { try { localStorage.setItem('apon-theme', t) } catch {} }, theme)
      for (const path of PAGES) {
        await go(path)
        if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'))
        for (const v of await axe()) {
          if (v.id === 'color-contrast') { contrast += v.n; report.push(`  ${theme} ${path} color-contrast ×${v.n}  ${v.sample[0] || ''}`) }
          else { failed = true; console.error(`✗ ${theme} ${path}: ${v.id} ×${v.n}`, v.sample) }
        }
      }
    }
    console.log(`color-contrast সমস্যা (সব পেজ মিলিয়ে): ${contrast}`); report.slice(0, 12).forEach((l) => console.log(l))
    const MAX_CONTRAST = Number(process.env.MAX_CONTRAST ?? 0)
    if (contrast > MAX_CONTRAST) { failed = true; console.error(`✗ কনট্রাস্ট ${contrast} > সীমা ${MAX_CONTRAST}`) }

    // ── ডায়ালগের কীবোর্ড আচরণ ──
    await go('/profile')
    await page.getByText('দেখার ধরন').click()
    await page.waitForSelector('[role=dialog]')
    const dlg = page.locator('[role=dialog]').last()
    assert.equal(await dlg.getAttribute('aria-modal'), 'true')
    assert.ok((await dlg.getAttribute('aria-labelledby')) || (await dlg.getAttribute('aria-label')), 'ডায়ালগের নাম আছে')
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), 'ফোকাস ডায়ালগের ভেতরে')
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), 'Tab ডায়ালগ ছেড়ে বেরোয়নি') }
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    assert.equal(await page.locator('[role=dialog]').count(), 0, 'Esc চাপলে বন্ধ')
    assert.ok(await page.evaluate(() => document.activeElement?.textContent?.includes('দেখার ধরন')), 'বন্ধ হলে ফোকাস বাটনে ফেরে')
    assert.deepEqual(errs, [], 'পেজ-এরর নেই')
    if (!failed) console.log('✓ a11y: axe নিয়ম ও ডায়ালগ-আচরণ ঠিক')
  } catch (e) { console.error('✗', e.message); failed = true }
  finally { await b?.close(); server?.kill(); if (failed) process.exitCode = 1 }
})()
