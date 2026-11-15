// অ্যাপের সব সাউন্ড এক জায়গায় (কোনো অডিও ফাইল লাগে না)।
// ব্রাউজার ইউজারের প্রথম ট্যাপ/ক্লিকের আগে সাউন্ড চালাতে দেয় না — তাই একটাই AudioContext
// বানিয়ে প্রথম ট্যাপেই আনলক করে রাখি; এরপর কল-রিং/ডিং যেকোনো সময় বাজতে পারে।
let ctx
const ac = () => {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    return ctx
  } catch { return null }
}

const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'click']
const unlock = () => { const c = ac(); if (c && c.state === 'running') EVENTS.forEach((e) => window.removeEventListener(e, unlock)) }
if (typeof window !== 'undefined') EVENTS.forEach((e) => window.addEventListener(e, unlock, { passive: true }))

const tone = (c, freq, at, dur, vol = 0.12, type = 'sine') => {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03)
}

export const playSend = () => { const c = ac(); if (!c) return; tone(c, 880, 0, 0.09); tone(c, 1320, 0.07, 0.12) }
export const playPop = () => { const c = ac(); if (!c) return; tone(c, 520, 0, 0.1); tone(c, 780, 0.09, 0.12); tone(c, 1040, 0.18, 0.18) }

// নতুন মেসেজ/নোটিফিকেশনের "ডিং"
export const playDing = () => {
  const c = ac(); if (!c) return
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime
  o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.12)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.5)
}

// কলের রিংটোন। 'in' = ইনকামিং (ফোনের মতো ডবল রিং + ভাইব্রেশন), 'out' = কলারের রিংব্যাক টোন
// ফেরত দেয় বন্ধ করার ফাংশন
export function ringtone(mode = 'in') {
  const play = () => {
    const c = ac(); if (!c) return
    if (mode === 'in') {
      for (const at of [0, 0.5]) { tone(c, 740, at, 0.2, 0.3, 'triangle'); tone(c, 988, at + 0.22, 0.2, 0.3, 'triangle') }
      navigator.vibrate?.([400, 200, 400])
    } else {
      tone(c, 425, 0, 1.1, 0.14)
    }
  }
  play()
  const iv = setInterval(play, mode === 'in' ? 2400 : 3500)
  return () => { clearInterval(iv); navigator.vibrate?.(0) }
}
