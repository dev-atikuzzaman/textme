// ভিডিও কলের ইফেক্ট: ক্যামেরার ফ্রেম canvas-এ ফিল্টার দিয়ে এঁকে নতুন ভিডিও ট্র্যাক বানায়
export const EFFECTS = [
  { id: 'none', label: 'কোনো নয়', css: 'none', emoji: '🚫' },
  { id: 'soft', label: 'টাচ-আপ', css: 'brightness(1.06) contrast(0.94) saturate(1.08) blur(0.7px)', emoji: '✨' },
  { id: 'portrait', label: 'পোর্ট্রেট', css: 'none', emoji: '🧑', portrait: true },
  { id: 'bright', label: 'উজ্জ্বল', css: 'brightness(1.22) contrast(1.05)', emoji: '☀️' },
  { id: 'warm', label: 'ওয়ার্ম', css: 'sepia(0.35) saturate(1.4) hue-rotate(-10deg)', emoji: '🌇' },
  { id: 'cool', label: 'কুল', css: 'saturate(1.2) hue-rotate(20deg) brightness(1.03)', emoji: '❄️' },
  { id: 'vintage', label: 'ভিন্টেজ', css: 'sepia(0.55) contrast(0.9) brightness(1.1) saturate(0.8)', emoji: '📷' },
  { id: 'drama', label: 'ড্রামা', css: 'contrast(1.35) saturate(1.3) brightness(0.95)', emoji: '🎭' },
  { id: 'bw', label: 'সাদা-কালো', css: 'grayscale(1) contrast(1.1)', emoji: '🎞️' },
]
export const fxSupported = () => {
  try { return 'filter' in document.createElement('canvas').getContext('2d') && typeof HTMLCanvasElement.prototype.captureStream === 'function' } catch { return false }
}

export function makeFx(rawTrack, effectId) {
  const def = EFFECTS.find((e) => e.id === effectId) || EFFECTS[0]
  const v = document.createElement('video')
  v.muted = true; v.playsInline = true; v.srcObject = new MediaStream([rawTrack]); v.play().catch(() => {})
  const st = rawTrack.getSettings?.() || {}
  const c = document.createElement('canvas')
  c.width = st.width || 640; c.height = st.height || 480
  const ctx = c.getContext('2d')
  const draw = () => {
    if (v.readyState < 2) return
    if (c.width !== v.videoWidth && v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight }
    const w = c.width, h = c.height
    if (def.portrait) {
      // ব্যাকগ্রাউন্ড ঝাপসা: পুরো ফ্রেম ঝাপসা, মাঝখানের ডিম্বাকার অংশ স্পষ্ট
      ctx.filter = 'blur(9px) brightness(1.03)'; ctx.drawImage(v, 0, 0, w, h)
      ctx.save(); ctx.beginPath(); ctx.ellipse(w / 2, h * 0.52, w * 0.34, h * 0.42, 0, 0, Math.PI * 2); ctx.clip()
      ctx.filter = 'none'; ctx.drawImage(v, 0, 0, w, h); ctx.restore()
    } else { ctx.filter = def.css; ctx.drawImage(v, 0, 0, w, h) }
  }
  const iv = setInterval(draw, 33)
  const track = c.captureStream(30).getVideoTracks()[0]
  return { track, stop: () => { clearInterval(iv); v.srcObject = null; track.stop() } }
}
