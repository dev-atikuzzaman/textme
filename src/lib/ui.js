// অ্যাপের সুন্দর টোস্ট ও কনফার্ম ডায়ালগ (ব্রাউজারের alert/confirm-এর বদলে)।
// যেকোনো জায়গা থেকে ব্যবহার করা যায়, হুক বা প্রোভাইডার লাগে না:
//   toast('সংরক্ষিত হয়েছে')            toast.success('...')   toast.error('...')
//   if (await confirmDialog('মুছবেন?', { danger: true, confirmText: 'মুছুন' })) { ... }
// <UIHost /> একবার App-এ বসানো থাকলেই চলে।

const listeners = new Set()
let seq = 0
const emit = (e) => listeners.forEach((f) => f(e))
export const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f) }

export const toast = (message, type = 'info', ms) => {
  if (!message) return
  emit({ k: 'toast', id: ++seq, message: String(message), type, ms })
}
toast.success = (m, ms) => toast(m, 'success', ms)
toast.error = (m, ms = 5000) => toast(m, 'error', ms)

// opts: { title, confirmText, cancelText, danger }  →  Promise<boolean>
export const confirmDialog = (message, opts = {}) =>
  new Promise((resolve) => emit({ k: 'confirm', id: ++seq, message, resolve, ...opts }))

// Supabase/ব্রাউজারের ইংরেজি এরর → সহজ বাংলা। আসল এরর কনসোলে থেকে যায়।
export const errMsg = (e, fallback = 'কিছু একটা সমস্যা হয়েছে — আবার চেষ্টা করুন') => {
  const m = String(e?.message || e || '')
  if (e) console.error(e)
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(m)) return 'ইন্টারনেট সংযোগ নেই বা দুর্বল — আবার চেষ্টা করুন'
  if (/jwt|not authenticated|refresh token/i.test(m)) return 'সেশনের মেয়াদ শেষ — আবার লগইন করুন'
  if (/row-level security|permission denied|not allowed/i.test(m)) return 'এই কাজের অনুমতি আপনার নেই'
  if (/duplicate key|already exists/i.test(m)) return 'এটি আগে থেকেই আছে'
  if (/too large|exceeded the maximum/i.test(m)) return 'ফাইলটি অনেক বড় — ছোট ফাইল দিন'
  return /[\u0980-\u09FF]/.test(m) ? m : fallback // বাংলা মেসেজ হলে যেমন আছে তেমনই দেখাই
}
