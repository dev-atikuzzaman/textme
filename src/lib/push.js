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

const OFF = 'apon-push-off' // ইউজার নিজে বন্ধ করলে অটো-রিনিউ হবে না
const optedOut = () => { try { return localStorage.getItem(OFF) === '1' } catch { return false } }
const setOptOut = (v) => { try { v ? localStorage.setItem(OFF, '1') : localStorage.removeItem(OFF) } catch { /* ignore */ } }

// সাবস্ক্রিপশন VAPID কী-র সাথে মিলছে কিনা (কী বদলালে পুরোনো সাবস্ক্রিপশনে পুশ যায় না)
const keyMatches = (sub) => {
  try {
    const k = sub.options?.applicationServerKey
    if (!k) return true
    const a = new Uint8Array(k), b = toBytes(KEY)
    return a.length === b.length && a.every((x, i) => x === b[i])
  } catch { return true }
}

async function getOrCreateSub(reg) {
  let sub = await reg.pushManager.getSubscription()
  if (sub && !keyMatches(sub)) { await sub.unsubscribe().catch(() => {}); sub = null }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) })
}

export async function enablePush() {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('নোটিফিকেশনের অনুমতি দেওয়া হয়নি')
  const reg = await navigator.serviceWorker.ready
  const sub = await getOrCreateSub(reg)
  setOptOut(false)
  await save(sub)
}

export async function disablePush() {
  setOptOut(true)
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

// অ্যাপ খুললে সাবস্ক্রিপশন সার্ভারের সাথে মিলিয়ে রাখে (অ্যাকাউন্ট বদলালেও কাজ করে)।
// অনুমতি দেওয়া আছে অথচ সাবস্ক্রিপশন হারিয়ে/মেয়াদ শেষ হয়ে গেলে নিজে থেকে নতুন বানিয়ে নেয় —
// না হলে পুশ চুপচাপ বন্ধ হয়ে যায়।
export async function syncPush() {
  try {
    if (!supported() || !KEY || Notification.permission !== 'granted' || optedOut()) return
    const reg = await navigator.serviceWorker.ready
    await save(await getOrCreateSub(reg))
  } catch { /* ignore */ }
}

// পুশ কেন আসছে না — ধাপে ধাপে যাচাই
export async function pushDiagnose() {
  const d = { supported: supported(), key: !!KEY, permission: 'Notification' in window ? Notification.permission : 'n/a', sw: false, sub: false, keyOk: true, saved: false }
  if (!d.supported) return d
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    d.sw = !!reg?.active
    const sub = await reg?.pushManager.getSubscription()
    d.sub = !!sub
    if (sub) {
      d.keyOk = KEY ? keyMatches(sub) : true
      const { data } = await supabase.from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).maybeSingle()
      d.saved = !!data
    }
  } catch { /* ignore */ }
  return d
}

// সার্ভার থেকে নিজের সব ডিভাইসে টেস্ট পুশ (Edge Function → VAPID → ব্রাউজার পুরো পথ যাচাই)
export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('send-push', { body: { test: true } })
  if (error) {
    let detail = error.message
    if (error.name === 'FunctionsFetchError') throw new Error('send-push ফাংশনে পৌঁছানো যায়নি — ফাংশনটি (নতুন কোডসহ) ডিপ্লয় করা আছে কিনা দেখুন')
    try { const b = await error.context.json(); detail = `${error.context.status} ${b.error || b.message || JSON.stringify(b)}` } catch { /* ignore */ }
    throw new Error(detail)
  }
  return data // { subs, sent, errors }
}
