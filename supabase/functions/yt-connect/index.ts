// ইউজারকে Google-এর অনুমতির পাতায় পাঠানোর লিংক বানায়। (JWT যাচাই চালু রাখুন)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function sign(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('STATE_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const payload = `${user.id}.${Date.now()}`
  const state = `${payload}.${await sign(payload)}`
  const params = new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
    redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/yt-callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
  })
  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
})
