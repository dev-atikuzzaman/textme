// ছোট সাউন্ড ইফেক্ট (কোনো ফাইল লাগে না): মেসেজ/পোস্ট পাঠানোর পর বাজে
let ctx
const ac = () => {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}
const tone = (c, freq, at, dur, vol = 0.12) => {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at
  o.type = 'sine'; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02)
}
export const playSend = () => { const c = ac(); if (!c) return; tone(c, 880, 0, 0.09); tone(c, 1320, 0.07, 0.12) }
export const playPop = () => { const c = ac(); if (!c) return; tone(c, 520, 0, 0.1); tone(c, 780, 0.09, 0.12); tone(c, 1040, 0.18, 0.18) }
