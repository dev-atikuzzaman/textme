// Google থেকে ফিরে এসে refresh token সেভ করে। ডিপ্লয়: supabase functions deploy yt-callback --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function sign(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('STATE_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const back = (q: string) => Response.redirect(`${Deno.env.get('APP_URL')}/reels?yt=${q}`, 302)

  const code = u.searchParams.get('code')
  if (u.searchParams.get('error') || !code) return back('denied')

  const [uid, ts, sig] = (u.searchParams.get('state') ?? '').split('.')
  if (!uid || !ts || !sig || sig !== await sign(`${uid}.${ts}`) || Date.now() - Number(ts) > 10 * 60 * 1000) return back('error')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/yt-callback`,
      grant_type: 'authorization_code',
    }),
  })
  const t = await r.json()
  if (!t.refresh_token) return back('error')

  await db.from('yt_tokens').upsert({ user_id: uid, refresh_token: t.refresh_token, updated_at: new Date().toISOString() })
  await db.from('yt_connections').upsert({ user_id: uid })
  return back('connected')
})
