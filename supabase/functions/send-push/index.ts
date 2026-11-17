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
}

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
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

  const [{ data: actor }, { data: subs }] = await Promise.all([
    db.from('profiles').select('full_name').eq('id', actorId).single(),
    db.from('push_subscriptions').select('*').in('user_id', targets),
  ])
  if (table === 'group_messages') body = `${actor?.full_name ?? ''}: ${record.content ? String(record.content).slice(0, 100) : '📷 ছবি'}`

  const payload = JSON.stringify({ title: title ?? actor?.full_name ?? 'বন্ধু', body, url, type, tag })
  const isCall = type === 'call'
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
        // কলে urgency high ও ছোট TTL (৪৫ সেকেন্ডের পর পুরোনো কল দেখানোর মানে নেই)
        { urgency: isCall ? 'high' : 'normal', TTL: isCall ? 45 : 60 * 60 * 24 },
      )
    } catch (e) {
      // মেয়াদোত্তীর্ণ সাবস্ক্রিপশন মুছে ফেলা
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return new Response('ok')
})
