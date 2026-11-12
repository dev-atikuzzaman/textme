import { supabase } from './supabase'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const toBytes = (s) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function save(sub) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
  if (error) throw error
}

// 'unsupported' | 'nokey' | 'denied' | 'off' | 'on'
export async function pushState() {
  if (!supported()) return 'unsupported'
  if (!KEY) return 'nokey'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

export async function enablePush() {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('নোটিফিকেশনের অনুমতি দেওয়া হয়নি')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) }))
  await save(sub)
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

// অ্যাপ খুললে সাবস্ক্রিপশন সার্ভারের সাথে মিলিয়ে রাখে (অ্যাকাউন্ট বদলালেও কাজ করে)
export async function syncPush() {
  try {
    if ((await pushState()) !== 'on') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await save(sub)
  } catch { /* ignore */ }
}
