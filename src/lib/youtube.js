import { supabase } from './supabase'

const FB_HOST = /(^|\.)facebook\.com$|^fb\.watch$|^fb\.com$/i

// শেয়ার করা লেখা থেকে ফেসবুক লিংক বের করে পরিষ্কার করে (ট্র্যাকিং প্যারামিটার বাদ)
export function parseFacebook(text = '') {
  for (const raw of String(text).match(/https?:\/\/[^\s]+/gi) || []) {
    try {
      const u = new URL(raw)
      if (!FB_HOST.test(u.hostname)) continue
      if (/(^|\.)facebook\.com$/i.test(u.hostname)) u.hostname = 'www.facebook.com'
      const v = u.searchParams.get('v')
      u.search = v ? `?v=${v}` : ''
      u.hash = ''
      return u.toString().replace(/\/$/, '')
    } catch { /* পরের লিংক দেখুন */ }
  }
  return null
}

export async function startYoutubeConnect() {
  const { data, error } = await supabase.functions.invoke('yt-connect')
  if (error || !data?.url) throw new Error('connect failed')
  window.location.href = data.url
}

export const syncMyShorts = () => supabase.functions.invoke('sync-shorts', { body: { parts: ['mine'] } })
export const disconnectYoutube = () => supabase.rpc('yt_disconnect')
