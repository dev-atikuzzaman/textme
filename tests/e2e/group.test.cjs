// গ্রুপ পেজ (ফাইল ভাঙার পর): ⋮ মেনু → গ্রুপ ইনফো শিট → সদস্য ও কলের বাটন। নকল Supabase।
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const PORT = 4177, APP = `http://localhost:${PORT}`
const ME = '11111111-1111-1111-1111-111111111111', FR = '22222222-2222-2222-2222-222222222222', G = '33333333-3333-3333-3333-333333333333'
const iso = (m) => new Date(Date.parse('2026-01-01T00:00:00Z') + m * 60000).toISOString()
const prof = (id, n) => ({ id, username: n, full_name: n + ' Name', avatar_url: null })
const groups = [{ id: G, name: 'পরিবার গ্রুপ', about: 'আমাদের পরিবার', privacy: 'private', created_by: ME, avatar_url: null, cover_url: null, created_at: iso(1) }]
const gm = [{ group_id: G, user_id: ME, role: 'admin', last_read_at: iso(1), joined_at: iso(1) }, { group_id: G, user_id: FR, role: 'member', last_read_at: iso(1), joined_at: iso(2) }]
async function startPreview() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) return p } catch {} await new Promise((r) => setTimeout(r, 500)) }
  p.kill(); throw new Error('preview চালু হয়নি (আগে npm run build:test চালান)')
}
;(async () => {
  let server, b
  try {
    server = await startPreview(); b = await chromium.launch()
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } })
    await ctx.addInitScript(([ME]) => { try {
      localStorage.setItem('apon-install-hide', '1'); localStorage.setItem('apon-push-hide', '1')
      localStorage.setItem('sb-fake-auth-token', JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 99999, expires_at: Math.floor(Date.now() / 1000) + 99999, user: { id: ME, aud: 'authenticated', email: 'm@x.com', app_metadata: {}, user_metadata: {} } }))
    } catch {} }, [ME])
    const page = await ctx.newPage(); const errs = []
    page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR|WebSocket connection/.test(m.text()) && errs.push(m.text().slice(0, 300)))
    await page.route('https://fake.supabase.co/**', async (r) => {
      const u = new URL(r.request().url()), q = u.searchParams, t = u.pathname.split('/').pop()
      const one = (r.request().headers().accept || '').includes('vnd.pgrst.object')
      const out = (arr) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(one ? (arr[0] ?? null) : arr) })
      if (u.pathname.includes('/auth/v1/user')) return out([{ id: ME, aud: 'authenticated', email: 'm@x.com' }])
      if (t === 'groups') return out(groups)
      if (t === 'group_members') return out(gm)
      if (t === 'profiles') return one ? out([prof(ME, 'Me')]) : out([prof(ME, 'Me'), prof(FR, 'Friend')])
      if (t === 'friendships') return out([{ id: 'f1', requester_id: ME, addressee_id: FR, status: 'accepted' }])
      if (t === 'group_messages') return out([{ id: 'g1', group_id: G, sender_id: FR, content: 'সবাই কেমন আছো?', media_url: null, media_type: null, created_at: iso(30) }])
      return out([])
    })
    await page.goto(APP + '/'); await page.waitForTimeout(400)
    await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, '/groups/' + G)
    await page.getByLabel('আরও অপশন').click()
    await page.getByRole('button', { name: 'গ্রুপ ইনফো' }).first().click()
    const dlg = page.locator('[role=dialog]').last(); await dlg.waitFor()
    const txt = await page.locator('body').innerText()
    for (const need of ['পরিবার গ্রুপ', 'আমাদের পরিবার', 'অডিও কল', 'ভিডিও কল', 'সদস্য (২)', 'Friend Name', 'গ্রুপ ছাড়ুন', 'গ্রুপ মুছে ফেলুন']) assert.ok(txt.includes(need), `ইনফো শিটে "${need}" নেই`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    assert.equal(await page.locator('[role=dialog]').count(), 0, 'Esc দিয়ে শিট বন্ধ')
    assert.deepEqual(errs, [], 'পেজ-এরর নেই')
    console.log('✓ e2e: গ্রুপ ইনফো শিট ঠিক')
  } catch (e) { console.error('✗', e.message); process.exitCode = 1 }
  finally { await b?.close(); server?.kill() }
})()
