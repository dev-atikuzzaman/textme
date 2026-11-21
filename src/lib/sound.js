// অ্যাপের সব সাউন্ড এক জায়গায়।
// ১) নোটিফিকেশন/মেসেজের "ডিং" এখন আসল MP3 ফাইল (/notify.mp3) থেকে বাজে (HTMLAudio) — WhatsApp-এর মতো স্পষ্ট ও জোরালো।
//    কোনো কারণে MP3 না বাজলে স্বয়ংক্রিয়ভাবে WebAudio-র তৈরি ডিং বাজে (ফলব্যাক)।
// ২) ব্রাউজার ইউজারের প্রথম ট্যাপের আগে সাউন্ড চালাতে দেয় না — তাই প্রথম ট্যাপেই AudioContext ও MP3 দুটোই আনলক করে রাখি।
// ৩) সাউন্ড চালু/বন্ধ ইউজার নোটিফিকেশন পেজ থেকে বদলাতে পারে।
const SKEY = 'apon-sound'
export const soundOn = () => { try { return localStorage.getItem(SKEY) !== 'off' } catch { return true } }
export const setSoundOn = (on) => { try { localStorage.setItem(SKEY, on ? 'on' : 'off') } catch { /* ignore */ } }

let ctx
const ac = () => {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    return ctx
  } catch { return null }
}

// ---------- MP3 ডিং (HTMLAudio) ----------
let ding, dingReady = false
const getDing = () => {
  if (typeof Audio === 'undefined') return null
  if (!ding) {
    ding = new Audio('/notify.mp3')
    ding.preload = 'auto'
    ding.setAttribute('playsinline', '')
  }
  return ding
}

// ইউজারের ট্যাপের মধ্যেই MP3 একবার নিঃশব্দে "চালিয়ে" আনলক করে রাখা (iOS/Android Chrome-এর নিয়ম)
const primeDing = () => {
  const a = getDing(); if (!a || dingReady) return
  a.muted = true
  const p = a.play()
  if (p && p.then) {
    p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; dingReady = true }).catch(() => { a.muted = false })
  }
}

const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'click']
const unlock = () => {
  const c = ac(); primeDing()
  if (c && c.state === 'running' && dingReady) EVENTS.forEach((e) => window.removeEventListener(e, unlock))
}
if (typeof window !== 'undefined') {
  EVENTS.forEach((e) => window.addEventListener(e, unlock, { passive: true }))
  // অ্যাপ পেছনে গিয়ে ফিরে এলে AudioContext suspend হয়ে যেতে পারে — আবার জাগিয়ে দিই
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}) })
}

// ---------- WebAudio টোন (সেন্ড/পপ/রিংটোন/ফলব্যাক) ----------
const tone = (c, freq, at, dur, vol = 0.12, type = 'sine') => {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.03)
}

export const playSend = () => { if (!soundOn()) return; const c = ac(); if (!c) return; tone(c, 880, 0, 0.09, 0.2); tone(c, 1320, 0.07, 0.12, 0.2) }
export const playPop = () => { if (!soundOn()) return; const c = ac(); if (!c) return; tone(c, 520, 0, 0.1, 0.2); tone(c, 780, 0.09, 0.12, 0.2); tone(c, 1040, 0.18, 0.18, 0.2) }

const synthDing = (vol = 0.6) => {
  const c = ac(); if (!c) return
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime
  o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.12)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.55)
  navigator.vibrate?.([120, 60, 120])
}

// নতুন মেসেজ/নোটিফিকেশনের "ডিং"। একই মুহূর্তে (Realtime + Push দুই দিক থেকে) এলে একবারই বাজে।
let lastDing = 0
export const playDing = (vol = 1) => {
  if (!soundOn()) return
  const now = Date.now()
  if (now - lastDing < 1200) return
  lastDing = now
  const a = getDing()
  if (a) {
    a.muted = false; a.volume = Math.min(1, Math.max(0, vol)); a.currentTime = 0
    const p = a.play()
    if (p && p.catch) p.catch(() => synthDing(0.6 * vol))
    navigator.vibrate?.([120, 60, 120])
  } else synthDing(0.6 * vol)
}

// কলের রিংটোন। 'in' = ইনকামিং (ফোনের মতো ডবল রিং + ভাইব্রেশন), 'out' = কলারের রিংব্যাক টোন
// ফেরত দেয় বন্ধ করার ফাংশন। কলের রিং সাউন্ড-সেটিংয়ে বন্ধ করা যায় না (কল মিস হওয়া ঠেকাতে)।
export function ringtone(mode = 'in') {
  const play = () => {
    const c = ac(); if (!c) return
    if (mode === 'in') {
      for (const at of [0, 0.5]) { tone(c, 740, at, 0.2, 0.45, 'triangle'); tone(c, 988, at + 0.22, 0.2, 0.45, 'triangle') }
      navigator.vibrate?.([400, 200, 400])
    } else {
      tone(c, 425, 0, 1.1, 0.14)
    }
  }
  play()
  const iv = setInterval(play, mode === 'in' ? 2400 : 3500)
  return () => { clearInterval(iv); navigator.vibrate?.(0) }
}
