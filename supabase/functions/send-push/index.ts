import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const TEXT: Record<string, string> = {
  like: 'আপনার পোস্টে লাইক দিয়েছেন',
  comment: 'আপনার পোস্টে কমেন্ট করেছেন',
  friend_request: 'আপনাকে ফ্রেন্ড রিকুয়েস্ট পাঠিয়েছেন',
  friend_accept: 'আপনার ফ্রেন্ড রিকুয়েস্ট গ্রহণ করেছেন',
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

  let userId: string, actorId: string, body: string, url: string
  if (table === 'notifications') {
    userId = record.user_id
    actorId = record.actor_id
    body = TEXT[record.type] ?? 'নতুন নোটিফিকেশন'
    url = record.post_id ? `/post/${record.post_id}` : record.type === 'friend_request' ? '/friends' : `/profile/${actorId}`
  } else if (table === 'messages') {
    userId = record.receiver_id
    actorId = record.sender_id
    body = String(record.content).slice(0, 120)
    url = `/chat/${actorId}`
  } else {
    return new Response('ignored')
  }

  const [{ data: actor }, { data: subs }] = await Promise.all([
    db.from('profiles').select('full_name').eq('id', actorId).single(),
    db.from('push_subscriptions').select('*').eq('user_id', userId),
  ])
  const payload = JSON.stringify({ title: actor?.full_name ?? 'আপন', body, url })

  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    } catch (e) {
      // মেয়াদোত্তীর্ণ সাবস্ক্রিপশন মুছে ফেলা
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return new Response('ok')
})
