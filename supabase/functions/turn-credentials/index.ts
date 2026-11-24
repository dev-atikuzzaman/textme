// লগ-ইন করা ইউজারকে Cloudflare TURN-এর সময়-সীমিত credential দেয়। (JWT যাচাই চালু রাখুন)
// Secrets: CF_TURN_KEY_ID, CF_TURN_API_TOKEN   (Cloudflare Dashboard → Realtime → TURN Server → Create)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const TTL = 12 * 60 * 60 // ১২ ঘণ্টা (সর্বোচ্চ ৪৮ ঘণ্টা; কলের সর্বোচ্চ সময়ের চেয়ে বেশি রাখুন)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } }
  if (!user) return json({ error: 'unauthorized' }, 401)

  const keyId = Deno.env.get('CF_TURN_KEY_ID'), apiToken = Deno.env.get('CF_TURN_API_TOKEN')
  if (!keyId || !apiToken) return json({ error: 'turn not configured' }, 503)

  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: TTL }),
  })
  if (!r.ok) return json({ error: 'turn upstream failed', status: r.status }, 502)

  const d = await r.json()
  // উত্তর অবজেক্ট বা অ্যারে — দুই রূপই সামলাই
  const s = Array.isArray(d.iceServers) ? d.iceServers.find((x: any) => x.username) : d.iceServers
  if (!s?.username || !s?.credential) return json({ error: 'bad upstream response' }, 502)

  const urls: string[] = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u: string) => !/:53(\?|$)/.test(u)) // পোর্ট ৫৩ ব্রাউজারে ব্লক
  const stun = urls.filter((u) => u.startsWith('stun:'))
  const turn = urls.filter((u) => !u.startsWith('stun:'))
  const iceServers = [
    ...(stun.length ? [{ urls: stun }] : []),
    { urls: turn, username: s.username, credential: s.credential },
  ]
  return json({ iceServers, ttl: TTL })
})
