// সাউন্ড ইফেক্ট (কোনো ফাইল লাগে না) — একটিই AudioContext সবখানে ব্যবহার হয়
let ctx
const ac = () => {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}
// ব্রাউজার প্রথম টাচ/ক্লিকের আগে অডিও চালাতে দেয় না — প্রথম ট্যাপে এটি ডাকলে সাউন্ড আনলক হয়ে যায়
export const unlockAudio = () => ac()
export const audioReady = () => !!ctx && ctx.state === 'running'

const tone = (c, freq, at, dur, vol = 0.12) => {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02)
}
// রিংয়ের জন্য টানা সুর (ধীরে শুরু, ধীরে শেষ)
const hold = (c, freq, at, dur, vol) => {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03)
  g.gain.setValueAtTime(vol, t + dur - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02)
}

export const playSend = () => { const c = ac(); if (!c) return; tone(c, 880, 0, 0.09); tone(c, 1320, 0.07, 0.12) }
export const playPop = () => { const c = ac(); if (!c) return; tone(c, 520, 0, 0.1); tone(c, 780, 0.09, 0.12); tone(c, 1040, 0.18, 0.18) }
// নতুন মেসেজ/নোটিফিকেশনের "ডিং"
export const playDing = () => { const c = ac(); if (!c) return; tone(c, 880, 0, 0.16, 0.3); tone(c, 1320, 0.11, 0.32, 0.3) }

// কলের রিংটোন: 'in' = ইনকামিং (জোরালো ডাবল-রিং + ভাইব্রেট), 'out' = কলার যা শোনে (নরম বিপ)
let ringIv = null
export const stopRingtone = () => {
  if (ringIv) { clearInterval(ringIv); ringIv = null }
  navigator.vibrate?.(0)
}
export const startRingtone = (mode = 'in') => {
  stopRingtone()
  const once = () => {
    const c = ac(); if (!c) return
    if (mode === 'in') {
      ;[0, 0.55].forEach((at) => { hold(c, 440, at, 0.42, 0.3); hold(c, 480, at, 0.42, 0.3) })
      navigator.vibrate?.([400, 200, 400])
    } else hold(c, 425, 0, 1.0, 0.1)
  }
  once()
  ringIv = setInterval(once, mode === 'in' ? 2800 : 4000)
}
