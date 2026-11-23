import { supabase } from './supabase'

// নোটিফিকেশন সেটিংস: কোন ধরনের অ্যালার্ট আসবে + "চুপ থাকার সময়"।
// সেভ হয় notification_prefs টেবিলে (update-22.sql)। সার্ভার (send-push) পুশ আটকায়, অ্যাপ নিজের ব্যানার/সাউন্ড আটকায়।
export const CATS = [
  { key: 'n_likes', label: 'লাইক', sub: 'কেউ আপনার পোস্টে লাইক দিলে' },
  { key: 'n_comments', label: 'কমেন্ট ও উত্তর', sub: 'পোস্টে কমেন্ট বা আপনার কমেন্টের উত্তর' },
  { key: 'n_friends', label: 'বন্ধু ও পোক', sub: 'ফ্রেন্ড রিকুয়েস্ট, গ্রহণ করা, পোক' },
  { key: 'n_posts', label: 'নতুন পোস্ট', sub: 'বন্ধু, গ্রুপ ও পেজের নতুন পোস্ট' },
  { key: 'n_messages', label: 'মেসেজ ও গ্রুপ চ্যাট', sub: 'নতুন মেসেজ (কল সবসময় আসবে)' },
  { key: 'n_family', label: 'পরিবার', sub: 'জন্মদিন, অনুষ্ঠানের রিমাইন্ডার, অ্যালবাম ও আমন্ত্রণ' },
]
export const TYPE_CAT = {
  like: 'n_likes', comment: 'n_comments', reply: 'n_comments',
  friend_request: 'n_friends', friend_accept: 'n_friends', poke: 'n_friends',
  post: 'n_posts', group_post: 'n_posts', page_post: 'n_posts', group_add: 'n_posts', group_call: 'n_messages',
  invite_joined: 'n_family', birthday: 'n_family', event_new: 'n_family', event_reminder: 'n_family', album_add: 'n_family',
}
export const DEFAULTS = { n_likes: true, n_comments: true, n_friends: true, n_posts: true, n_messages: true, n_family: true, quiet_on: false, quiet_from: 1320, quiet_to: 420 }

export const minsToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const timeToMins = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
export const tzOffset = () => -new Date().getTimezoneOffset() // UTC থেকে কত মিনিট এগিয়ে (বাংলাদেশ = ৩৬০)

// এখন কি "চুপ থাকার সময়"? (ডিভাইসের স্থানীয় সময় ধরে)
export function quietNow(p, d = new Date()) {
  if (!p?.quiet_on) return false
  const mins = d.getHours() * 60 + d.getMinutes()
  const a = p.quiet_from ?? 1320, b = p.quiet_to ?? 420
  if (a === b) return false
  return a < b ? mins >= a && mins < b : mins >= a || mins < b
}

export async function loadPrefs() {
  const { data, error } = await supabase.from('notification_prefs').select('*').maybeSingle()
  if (error) return { ...DEFAULTS, _missing: /relation|schema cache|does not exist/i.test(error.message || '') }
  return { ...DEFAULTS, ...(data || {}) }
}

export async function savePrefs(userId, patch) {
  const { error } = await supabase.from('notification_prefs')
    .upsert({ user_id: userId, ...patch, tz_offset: tzOffset(), updated_at: new Date().toISOString() })
  if (!error) window.dispatchEvent(new Event('apon-prefs')) // NotifProvider নতুন সেটিং আবার পড়ে নেয়
  return error
}
