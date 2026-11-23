import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const TEXT: Record<string, string> = {
  like: 'আপনার পোস্টে লাইক দিয়েছেন',
  comment: 'আপনার পোস্টে কমেন্ট করেছেন',
  reply: 'আপনার কমেন্টের উত্তর দিয়েছেন',
  friend_request: 'আপনাকে ফ্রেন্ড রিকুয়েস্ট পাঠিয়েছেন',
  friend_accept: 'আপনার ফ্রেন্ড রিকুয়েস্ট গ্রহণ করেছেন',
  post: 'নতুন পোস্ট করেছেন',
  group_post: 'আপনার গ্রুপে নতুন পোস্ট করেছেন',
  page_post: 'আপনার ফলো করা পেজে নতুন পোস্ট করেছেন',
  group_add: 'আপনাকে একটি গ্রুপে যোগ করেছেন',
  poke: 'আপনাকে পোক করেছেন 👉',
  group_call: 'গ্রুপ কল শুরু করেছেন 📞 — যোগ দিন',
  invite_joined: 'আপনার আমন্ত্রণে যোগ দিয়েছেন — এখন আপনারা বন্ধু 🎉',
  birthday: 'আজ জন্মদিন পালন করছেন 🎂 — শুভেচ্ছা জানান',
  event_new: 'একটি নতুন অনুষ্ঠানের আয়োজন করেছেন 📅',
  event_reminder: 'আয়োজিত অনুষ্ঠানটি খুব কাছে 📅',
  album_add: 'আপনাকে একটি ফ্যামিলি অ্যালবামে যোগ করেছেন 📷',
}

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// ── নোটিফিকেশন সেটিংস (notification_prefs): ক্যাটেগরি বন্ধ বা "চুপ থাকার সময়" হলে ওই ইউজারকে পুশ যায় না (কল ছাড়া) ──
const CAT: Record<string, string> = {
  like: 'n_likes', comment: 'n_comments', reply: 'n_comments',
  friend_request: 'n_friends', friend_accept: 'n_friends', poke: 'n_friends',
  post: 'n_posts', group_post: 'n_posts', page_post: 'n_posts', group_add: 'n_posts', group_call: 'n_messages',
  invite_joined: 'n_family', birthday: 'n_family', event_new: 'n_family', event_reminder: 'n_family', album_add: 'n_family',
}
function inQuiet(p: any, now = new Date()): boolean {
  if (!p?.quiet_on) return false
  const mins = (now.getUTCHours() * 60 + now.getUTCMinutes() + (p.tz_offset ?? 360) + 1440) % 1440
  const a = p.quiet_from ?? 1320, b = p.quiet_to ?? 420
  if (a === b) return false
  return a < b ? mins >= a && mins < b : mins >= a || mins < b
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// একটি পুশ পাঠায়; মেয়াদোত্তীর্ণ (404/410) সাবস্ক্রিপশন মুছে ফেলে। ফেরত দেয় { sent, errors }
async function deliver(subs: any[], payload: string, isCall: boolean) {
  let sent = 0
  const errors: string[] = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
        // কলে urgency high ও ছোট TTL (৪৫ সেকেন্ডের পর পুরোনো কল দেখানোর মানে নেই)
        { urgency: isCall ? 'high' : 'normal', TTL: isCall ? 45 : 60 * 60 * 24 },
      )
      sent++
    } catch (e) {
      errors.push(`${e.statusCode ?? 'ERR'}: ${String(e.body ?? e.message ?? e).slice(0, 120)}`)
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return { sent, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // ── অ্যাপ থেকে "সার্ভার টেস্ট পুশ": লগ-ইন করা ইউজার নিজের সব ডিভাইসে একটি টেস্ট পুশ পাঠায় ──
  // (ট্রিগার/ওয়েবহুক ছাড়াই VAPID কী, সাবস্ক্রিপশন ও Edge Function ঠিক আছে কিনা যাচাই হয়)
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } }
    let body: any = {}
    try { body = await req.json() } catch { /* ignore */ }
    if (!u?.user || body?.test !== true) return json({ error: 'forbidden' }, 403)
    const { data: mine } = await db.from('push_subscriptions').select('*').eq('user_id', u.user.id)
    if (!mine?.length) return json({ subs: 0, sent: 0, errors: [] })
    const r = await deliver(mine, JSON.stringify({ title: 'বন্ধু — টেস্ট', body: 'সাউন্ড ও পপ-আপ ঠিক আছে ✅', url: '/notifications', type: 'test', tag: 'apon-test' }), false)
    return json({ subs: mine.length, ...r })
  }
  const { table, record } = await req.json()

  let targets: string[] = [], actorId: string, body: string, url: string
  let type = '', title: string | null = null, tag: string | undefined

  if (table === 'notifications') {
    targets = [record.user_id]
    actorId = record.actor_id
    body = TEXT[record.type] ?? 'নতুন নোটিফিকেশন'
    url = record.link ?? (record.post_id ? `/post/${record.post_id}` : record.type === 'friend_request' ? '/friends' : `/profile/${actorId}`)
  } else if (table === 'messages') {
    if (record.type === 'call') {
      // শুধু কল শুরুর মুহূর্তে (calling) রিং-স্টাইল পুশ; পরে আপডেট হলে নয়
      if (record.meta?.status !== 'calling') return new Response('ignored')
      type = 'call'
      body = record.meta?.kind === 'video' ? '📹 ভিডিও কল করছেন…' : '📞 অডিও কল করছেন…'
      url = `/chat/${record.sender_id}?call=${record.id}`
      tag = `call-${record.sender_id}`
    } else {
      body = String(record.content ?? '').slice(0, 120)
      url = `/chat/${record.sender_id}`
      tag = `msg-${record.sender_id}`
      if (!body) body = '📎 নতুন মেসেজ'
    }
    targets = [record.receiver_id]
    actorId = record.sender_id
  } else if (table === 'group_messages') {
    const [{ data: g }, { data: ms }] = await Promise.all([
      db.from('groups').select('name').eq('id', record.group_id).single(),
      db.from('group_members').select('user_id').eq('group_id', record.group_id),
    ])
    targets = (ms ?? []).map((m) => m.user_id).filter((id) => id !== record.sender_id)
    actorId = record.sender_id
    title = g?.name ?? 'গ্রুপ'
    body = '' // নিচে প্রেরকের নামসহ বসবে
    url = `/groups/${record.group_id}?tab=chat`
    tag = `group-${record.group_id}`
  } else {
    return new Response('ignored')
  }
  if (!targets.length) return new Response('no targets')

  // সেটিংস অনুযায়ী ছেঁকে নিই (টেবিল না থাকলে বা সেটিং না থাকলে আগের মতোই সবাইকে পাঠানো হয়)
  const cat = table === 'notifications' ? CAT[record.type] : (type === 'call' ? null : 'n_messages')
  const { data: prefs } = await db.from('notification_prefs').select('*').in('user_id', targets)
  const pm = new Map<string, any>((prefs ?? []).map((p: any) => [p.user_id, p] as [string, any]))
  targets = targets.filter((uid) => {
    const p = pm.get(uid)
    if (!p) return true
    if (cat && p[cat] === false) return false
    if (type !== 'call' && inQuiet(p)) return false
    return true
  })
  if (!targets.length) return new Response('muted by user settings')

  const [{ data: actor }, { data: subs }] = await Promise.all([
    db.from('profiles').select('full_name').eq('id', actorId).single(),
    db.from('push_subscriptions').select('*').in('user_id', targets),
  ])
  if (table === 'group_messages') body = `${actor?.full_name ?? ''}: ${record.content ? String(record.content).slice(0, 100) : '📷 ছবি'}`

  const payload = JSON.stringify({ title: title ?? actor?.full_name ?? 'বন্ধু', body, url, type, tag })
  const isCall = type === 'call'
  const r = await deliver(subs ?? [], payload, isCall)
  console.log(`push ${table}: subs=${subs?.length ?? 0} sent=${r.sent} errors=${JSON.stringify(r.errors)}`)
  return json({ ok: true, subs: subs?.length ?? 0, sent: r.sent })
})
