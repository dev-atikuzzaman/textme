// ইউটিউব শর্টস সিঙ্ক। ডিপ্লয়: supabase functions deploy sync-shorts --no-verify-jwt
// ১) cron (x-webhook-secret হেডার): parts = subs
// ২) লগ-ইন করা ইউজার: parts = ['mine'] (শুধু নিজের সাবস্ক্রিপশন, ১০ মিনিটে একবার)
import { createClient } from 'npm:@supabase/supabase-js@2'

let cors: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const KEY = Deno.env.get('YOUTUBE_API_KEY')!
const API = 'https://www.googleapis.com/youtube/v3'
const MAX_SECONDS = 180 // শর্টস এখন সর্বোচ্চ ৩ মিনিট

const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

async function yt(path: string, params: Record<string, string>, token?: string) {
  const qs = new URLSearchParams(token ? params : { ...params, key: KEY })
  const r = await fetch(`${API}/${path}?${qs}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
  if (!r.ok) throw Object.assign(new Error(`${path} ${r.status}`), { status: r.status })
  return r.json()
}

const secs = (d?: string) => {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d ?? '')
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

// videos.list এর একটি আইটেম থেকে সারি বানায়; শর্টস না হলে বা embed বন্ধ থাকলে null
function toRow(it: any, max = MAX_SECONDS) {
  const d = secs(it.contentDetails?.duration)
  if (!d || d > max) return null
  if (it.status?.embeddable === false || it.status?.privacyStatus !== 'public') return null
  if (it.snippet?.liveBroadcastContent && it.snippet.liveBroadcastContent !== 'none') return null
  return {
    external_id: it.id as string,
    title: it.snippet.title,
    channel_id: it.snippet.channelId,
    channel_title: it.snippet.channelTitle,
    thumbnail: `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
    published_at: it.snippet.publishedAt,
  }
}

async function details(ids: string[], max = MAX_SECONDS) {
  const rows: any[] = []
  for (const c of chunk([...new Set(ids)], 50)) {
    const d = await yt('videos', { part: 'snippet,contentDetails,status', id: c.join(',') })
    for (const it of d.items ?? []) { const r = toRow(it, max); if (r) rows.push(r) }
  }
  return rows
}

// একই ভিডিও একাধিক ফিডে থাকতে পারে, তাই feeds মিলিয়ে সেভ করা হয়
async function save(rows: any[], feed: string, category?: string) {
  if (!rows.length) return
  const prev = new Map<string, string[]>()
  for (const c of chunk(rows.map((r) => r.external_id), 100)) {
    const { data } = await db.from('external_videos').select('external_id,feeds').eq('source', 'youtube').in('external_id', c)
    for (const o of data ?? []) prev.set(o.external_id, o.feeds ?? [])
  }
  const now = new Date().toISOString()
  const out = rows.map((r) => ({
    ...r,
    source: 'youtube',
    url: `https://www.youtube.com/shorts/${r.external_id}`,
    feeds: [...new Set([...(prev.get(r.external_id) ?? []), feed])],
    fetched_at: now,
    ...(category ? { category } : {}),
  }))
  for (const c of chunk(out, 200)) await db.from('external_videos').upsert(c, { onConflict: 'source,external_id' })
}

async function refreshAccess(refresh: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  return { token: r.ok ? (j.access_token as string) : null, revoked: j.error === 'invalid_grant' }
}

// ইউজারের সাবস্ক্রিপশন তালিকা এনে yt_subscriptions এ বসায়
async function syncUserSubs(uid: string): Promise<string[]> {
  const { data: tok } = await db.from('yt_tokens').select('refresh_token').eq('user_id', uid).maybeSingle()
  if (!tok) return []
  const a = await refreshAccess(tok.refresh_token)
  if (a.revoked) { // অনুমতি ফিরিয়ে নেওয়া বা মেয়াদ শেষ: ইউজারকে আবার কানেক্ট করতে হবে
    await db.from('yt_tokens').delete().eq('user_id', uid)
    await db.from('yt_subscriptions').delete().eq('user_id', uid)
    await db.from('yt_connections').delete().eq('user_id', uid)
    return []
  }
  if (!a.token) throw new Error('token refresh failed')

  const ids: string[] = []
  let pageToken: string | undefined
  for (let i = 0; i < 10; i++) { // সর্বোচ্চ ৫০০ চ্যানেল
    const d = await yt('subscriptions', { part: 'snippet', mine: 'true', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, a.token)
    for (const it of d.items ?? []) { const c = it.snippet?.resourceId?.channelId; if (c) ids.push(c) }
    pageToken = d.nextPageToken
    if (!pageToken) break
  }
  await db.from('yt_subscriptions').delete().eq('user_id', uid)
  for (const c of chunk(ids, 500)) await db.from('yt_subscriptions').insert(c.map((channel_id) => ({ user_id: uid, channel_id })))
  await db.from('yt_connections').upsert({ user_id: uid, channel_count: ids.length, synced_at: new Date().toISOString() })
  return ids
}

// চ্যানেল ID "UC…" এর জায়গায় "UUSH…" বসালে ওই চ্যানেলের শুধু শর্টসের প্লেলিস্ট পাওয়া যায়
async function doChannels(channels: string[], out: Record<string, unknown>) {
  const ids: string[] = []
  for (const group of chunk(channels.filter((c) => c.startsWith('UC')), 10)) {
    await Promise.all(group.map(async (c) => {
      try {
        const d = await yt('playlistItems', { part: 'contentDetails', playlistId: 'UUSH' + c.slice(2), maxResults: '8' })
        for (const it of d.items ?? []) ids.push(it.contentDetails.videoId)
      } catch (e: any) { if (e.status !== 404) throw e } // শর্টস নেই এমন চ্যানেল বাদ
    }))
  }
  const rows = await details(ids)
  await save(rows, 'sub')
  out.sub_shorts = rows.length
}

Deno.serve(async (req) => {
  cors = { ...cors, 'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') ?? cors['Access-Control-Allow-Headers'] }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))
  const out: Record<string, unknown> = {}

  try {
    if (req.headers.get('x-webhook-secret') === Deno.env.get('WEBHOOK_SECRET')) {
      if ((body.parts ?? ['subs']).includes('subs')) {
        const { data: users } = await db.from('yt_connections').select('user_id')
        for (const u of users ?? []) {
          try { await syncUserSubs(u.user_id) } catch (e: any) { out[`user_${u.user_id.slice(0, 8)}`] = `error ${e.message}` }
        }
        const { data: subs } = await db.from('yt_subscriptions').select('channel_id').range(0, 4999)
        await doChannels([...new Set((subs ?? []).map((s) => s.channel_id))], out)
      }
      // ৩০ দিনের পুরনো অটো-ফেচ করা ভিডিও মুছে ফেলা (শেয়ার করা লিংক থাকে)
      await db.from('external_videos').delete().eq('source', 'youtube').is('added_by', null)
        .lt('fetched_at', new Date(Date.now() - 30 * 864e5).toISOString())
      return json(out)
    }

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return json({ error: 'forbidden' }, 403)

    const { data: c } = await db.from('yt_connections').select('synced_at').eq('user_id', user.id).maybeSingle()
    if (!c) return json({ error: 'not_connected' }, 400)
    if (c.synced_at && Date.now() - new Date(c.synced_at).getTime() < 10 * 60 * 1000) return json({ skipped: true })

    await doChannels(await syncUserSubs(user.id), out)
    return json(out)
  } catch (e: any) {
    return json({ error: e.message, ...out }, 500)
  }
})
