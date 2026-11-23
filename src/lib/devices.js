import { supabase } from './supabase'

// লগইন করা ডিভাইসের তালিকা (login_devices, update-22.sql)। এই ডিভাইসের পরিচয় localStorage-এ থাকে
const DK = 'apon-device-id', SK = 'apon-device-seen'
export const deviceId = () => {
  try { let d = localStorage.getItem(DK); if (!d) { d = crypto.randomUUID(); localStorage.setItem(DK, d) } return d } catch { return 'unknown' }
}
export function deviceLabel() {
  const ua = navigator.userAgent
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iPhone/iPad' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : 'ডিভাইস'
  const br = /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'ব্রাউজার'
  const app = window.matchMedia?.('(display-mode: standalone)').matches ? ' (অ্যাপ)' : ''
  return `${br} • ${os}${app}`
}
// অ্যাপ খুললে (ঘণ্টায় সর্বোচ্চ একবার) এই ডিভাইস তালিকায় যোগ/হালনাগাদ
export async function registerDevice(userId) {
  try {
    const last = Number(localStorage.getItem(SK)) || 0
    if (Date.now() - last < 3600e3) return
    localStorage.setItem(SK, String(Date.now()))
    await supabase.from('login_devices').upsert(
      { user_id: userId, device_id: deviceId(), label: deviceLabel(), last_seen: new Date().toISOString() },
      { onConflict: 'user_id,device_id' })
  } catch { /* ঐচ্ছিক সুবিধা */ }
}
