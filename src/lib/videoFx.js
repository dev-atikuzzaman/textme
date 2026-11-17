// ভিডিও কলের ব্যাকগ্রাউন্ড বদল: MediaPipe সেলফি-সেগমেন্টেশন দিয়ে মানুষটাকে আলাদা করে পেছনে নতুন ব্যাকগ্রাউন্ড বসায়।
// মডেল ও wasm ফাইল /public/mediapipe-এ আছে (বাইরের সার্ভার লাগে না); প্রথমবার চালু করলে একটু সময় নেয়।
export const EFFECTS = [
  { id: 'none', label: 'কোনো নয়', emoji: '🚫', css: '#334155' },
  { id: 'blur', label: 'ঝাপসা', emoji: '🌫️', css: 'linear-gradient(135deg,#94a3b8,#e2e8f0)' },
  { id: 'bg:office', label: 'অফিস', emoji: '🏢', css: 'linear-gradient(135deg,#d6c7b0,#8b7355)' },
  { id: 'bg:sunset', label: 'সূর্যাস্ত', emoji: '🌇', css: 'linear-gradient(180deg,#ff9a5a,#c0396b)' },
  { id: 'bg:ocean', label: 'সাগর', emoji: '🌊', css: 'linear-gradient(180deg,#7dd3fc,#0369a1)' },
  { id: 'bg:forest', label: 'বন', emoji: '🌲', css: 'linear-gradient(180deg,#86efac,#14532d)' },
  { id: 'bg:night', label: 'রাতের আকাশ', emoji: '🌌', css: 'linear-gradient(180deg,#1e1b4b,#0f172a)' },
  { id: 'bg:studio', label: 'স্টুডিও', emoji: '🎬', css: 'linear-gradient(135deg,#334155,#0f172a)' },
]
export const fxSupported = () => {
  try { return 'filter' in document.createElement('canvas').getContext('2d') && typeof HTMLCanvasElement.prototype.captureStream === 'function' } catch { return false }
}

// নিজের ছবি ব্যাকগ্রাউন্ড (id: 'bg:custom')
let customImg = null
export const hasCustomBg = () => !!customImg
export function setCustomBg(file) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => { customImg = img; res() }
    img.onerror = () => rej(new Error('ছবিটি খোলা যায়নি'))
    img.src = URL.createObjectURL(file)
  })
}

// ---- সেগমেন্টেশন মডেল (একবারই লোড হয়) ----
let segPromise = null
function loadSeg() {
  if (segPromise) return segPromise
  segPromise = new Promise((resolve, reject) => {
    const boot = () => {
      try {
        const seg = new window.SelfieSegmentation({ locateFile: (f) => `/mediapipe/${f}` })
        seg.setOptions({ modelSelection: 1, selfieMode: false })
        seg.initialize().then(() => resolve(seg), reject)
      } catch (e) { reject(e) }
    }
    if (window.SelfieSegmentation) return boot()
    const s = document.createElement('script')
    s.src = '/mediapipe/selfie_segmentation.js'
    s.onload = boot; s.onerror = () => reject(new Error('মডেল লোড হয়নি'))
    document.head.appendChild(s)
  }).catch((e) => { segPromise = null; throw e })
  return segPromise
}

// ---- আঁকা ব্যাকগ্রাউন্ড (ক্যাশ করা) ----
const cache = new Map()
function paintBg(id, w, h) {
  const k = `${id}:${w}x${h}`
  if (cache.has(k)) return cache.get(k)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  const lg = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g }
  if (id === 'office') {
    x.fillStyle = lg(0, h, [[0, '#e8dcc6'], [1, '#bfae92']]); x.fillRect(0, 0, w, h)
    x.fillStyle = '#9ec9e8'; x.fillRect(w * 0.08, h * 0.12, w * 0.3, h * 0.42)        // জানালা
    x.fillStyle = '#ffffff55'; x.fillRect(w * 0.08, h * 0.12, w * 0.3, h * 0.42)
    x.fillStyle = '#e8dcc6'; x.fillRect(w * 0.225, h * 0.12, w * 0.012, h * 0.42); x.fillRect(w * 0.08, h * 0.32, w * 0.3, h * 0.012)
    x.fillStyle = '#7a5c3a'; x.fillRect(w * 0.58, h * 0.2, w * 0.34, h * 0.025); x.fillRect(w * 0.58, h * 0.42, w * 0.34, h * 0.025) // তাক
    const cols = ['#c0392b', '#2c7a7b', '#d69e2e', '#2b6cb0', '#6b46c1']
    for (let i = 0; i < 9; i++) { x.fillStyle = cols[i % 5]; x.fillRect(w * (0.6 + i * 0.033), h * (0.1 + (i % 2) * 0.02), w * 0.026, h * (0.1 - (i % 2) * 0.02)) }
    for (let i = 0; i < 7; i++) { x.fillStyle = cols[(i + 2) % 5]; x.fillRect(w * (0.6 + i * 0.04), h * 0.32, w * 0.03, h * 0.1) }
    x.fillStyle = '#6b4f2e'; x.fillRect(0, h * 0.86, w, h * 0.14)                       // মেঝে/টেবিল
  } else if (id === 'sunset') {
    x.fillStyle = lg(0, h, [[0, '#3b2a6b'], [0.45, '#d9486b'], [0.8, '#ff9a5a'], [1, '#ffd27a']]); x.fillRect(0, 0, w, h)
    x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(w * 0.5, h * 0.66, h * 0.13, 0, 7); x.fill()
    x.fillStyle = '#2b1b3d'; x.beginPath(); x.moveTo(0, h); x.lineTo(0, h * 0.8); x.lineTo(w * 0.22, h * 0.7); x.lineTo(w * 0.42, h * 0.82); x.lineTo(w * 0.7, h * 0.68); x.lineTo(w, h * 0.8); x.lineTo(w, h); x.fill()
  } else if (id === 'ocean') {
    x.fillStyle = lg(0, h, [[0, '#bfe9ff'], [0.5, '#4fb3e8'], [1, '#05507f']]); x.fillRect(0, 0, w, h)
    x.fillStyle = '#ffe9a8'; x.beginPath(); x.arc(w * 0.8, h * 0.18, h * 0.07, 0, 7); x.fill()
    for (let r = 0; r < 6; r++) { x.strokeStyle = `rgba(255,255,255,${0.12 + r * 0.04})`; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= w; i += 8) { const y = h * (0.55 + r * 0.08) + Math.sin(i / 38 + r) * 7; i ? x.lineTo(i, y) : x.moveTo(i, y) } x.stroke() }
  } else if (id === 'forest') {
    x.fillStyle = lg(0, h, [[0, '#d9f99d'], [1, '#3f8f4a']]); x.fillRect(0, 0, w, h)
    for (let layer = 0; layer < 3; layer++) {
      x.fillStyle = ['#4d9a5a', '#2f7a42', '#14532d'][layer]
      for (let i = -1; i < 9; i++) { const bx = (i + layer * 0.37) * (w / 7), th = h * (0.38 + layer * 0.1 + ((i * 7 + layer * 3) % 3) * 0.04), by = h * (0.62 + layer * 0.12)
        x.beginPath(); x.moveTo(bx, by - th); x.lineTo(bx - w * 0.07, by); x.lineTo(bx + w * 0.07, by); x.fill() }
    }
  } else if (id === 'night') {
    x.fillStyle = lg(0, h, [[0, '#0b1026'], [0.6, '#241b5c'], [1, '#5b3a8a']]); x.fillRect(0, 0, w, h)
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; x.beginPath(); x.arc(rnd() * w, rnd() * h * 0.8, rnd() * 1.8 + 0.4, 0, 7); x.fill() }
    x.fillStyle = '#fdf6d8'; x.beginPath(); x.arc(w * 0.78, h * 0.2, h * 0.075, 0, 7); x.fill()
    x.fillStyle = '#241b5c'; x.beginPath(); x.arc(w * 0.8, h * 0.19, h * 0.07, 0, 7); x.fill()
  } else if (id === 'studio') {
    const g = x.createRadialGradient(w / 2, h * 0.4, h * 0.05, w / 2, h * 0.5, h * 0.9); g.addColorStop(0, '#5b6b82'); g.addColorStop(1, '#0b1220')
    x.fillStyle = g; x.fillRect(0, 0, w, h)
  } else { x.fillStyle = '#334155'; x.fillRect(0, 0, w, h) }
  cache.set(k, c); if (cache.size > 12) cache.delete(cache.keys().next().value)
  return c
}
function drawCover(x, img, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height
  const r = Math.max(w / iw, h / ih); const dw = iw * r, dh = ih * r
  x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

// rawTrack থেকে নতুন ট্র্যাক: effectId 'none' হলে আসল ট্র্যাকই চলবে (useLocalMedia-তে দেখুন)
export function makeFx(rawTrack, effectId, onState) {
  const v = document.createElement('video')
  v.muted = true; v.playsInline = true; v.srcObject = new MediaStream([rawTrack]); v.play().catch(() => {})
  const st = rawTrack.getSettings?.() || {}
  const out = document.createElement('canvas'); out.width = st.width || 640; out.height = st.height || 480
  const ctx = out.getContext('2d')
  const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d')
  let seg = null, stopped = false, busy = false, failed = false
  loadSeg().then((s) => { seg = s; onState?.('ready') }).catch(() => { failed = true; onState?.('failed') })
  onState?.('loading')

  const compose = (mask) => {
    const w = out.width, h = out.height
    if (tmp.width !== w) { tmp.width = w; tmp.height = h }
    // ১) মানুষের অংশ: ফ্রেম × মাস্ক
    tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, w, h)
    tctx.drawImage(mask, 0, 0, w, h)
    tctx.globalCompositeOperation = 'source-in'; tctx.drawImage(v, 0, 0, w, h)
    // ২) পেছনে ব্যাকগ্রাউন্ড
    ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'
    if (effectIdRef === 'blur') { ctx.filter = 'blur(14px)'; ctx.drawImage(v, 0, 0, w, h); ctx.filter = 'none' }
    else if (effectIdRef === 'bg:custom' && customImg) drawCover(ctx, customImg, w, h)
    else ctx.drawImage(paintBg(effectIdRef.replace('bg:', ''), w, h), 0, 0)
    ctx.drawImage(tmp, 0, 0)
  }
  let effectIdRef = effectId
  const tick = async () => {
    if (stopped || busy || v.readyState < 2 || !v.videoWidth) return
    if (out.width !== v.videoWidth) { out.width = v.videoWidth; out.height = v.videoHeight }
    if (!seg || failed) { ctx.filter = 'none'; ctx.drawImage(v, 0, 0, out.width, out.height); return } // মডেল না আসা পর্যন্ত সাধারণ ভিডিও
    busy = true
    try {
      seg.onResults((r) => { if (!stopped) compose(r.segmentationMask) })
      await seg.send({ image: v })
    } catch { failed = true; onState?.('failed') } finally { busy = false }
  }
  const iv = setInterval(tick, 40)
  const track = out.captureStream(25).getVideoTracks()[0]
  return { track, setId: (id) => { effectIdRef = id }, stop: () => { stopped = true; clearInterval(iv); v.srcObject = null; track.stop() } }
}
