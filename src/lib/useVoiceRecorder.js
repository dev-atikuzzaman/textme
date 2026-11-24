import { useCallback, useEffect, useRef, useState } from 'react'

// রেকর্ডিংয়ের সময় নেওয়া আওয়াজের মাপ থেকে n টি তরঙ্গ-দণ্ড (০–১) বানানো
export const toBars = (arr, n = 40) => {
  if (!arr.length) return null
  const out = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * arr.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * arr.length) / n))
    let m = 0
    for (let j = a; j < b && j < arr.length; j++) m = Math.max(m, arr[j])
    out.push(Math.round(m * 100) / 100)
  }
  return out
}

// ভয়েস মেসেজ রেকর্ডার। stop(true) চাপলে (১ সেকেন্ড বা বেশি হলে) onFinish(file, { duration, peaks }) ডাকে।
export function useVoiceRecorder({ onFinish, onError }) {
  const [rec, setRec] = useState(null) // null | { secs }
  const mr = useRef(), chunks = useRef([]), timer = useRef(), startAt = useRef()
  const peakBuf = useRef([]), peakTimer = useRef(), peakCtx = useRef()
  const cb = useRef({ onFinish, onError }); cb.current = { onFinish, onError }

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // আওয়াজের ওঠানামা মেপে রাখি, যাতে প্লেয়ারে আসল তরঙ্গ দেখানো যায়
      peakBuf.current = []
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        const actx = new AC(); peakCtx.current = actx
        const an = actx.createAnalyser(); an.fftSize = 256
        actx.createMediaStreamSource(stream).connect(an)
        const data = new Uint8Array(an.fftSize)
        clearInterval(peakTimer.current)
        peakTimer.current = setInterval(() => {
          an.getByteTimeDomainData(data)
          let mx = 0; for (let i = 0; i < data.length; i++) mx = Math.max(mx, Math.abs(data[i] - 128))
          peakBuf.current.push(Math.min(1, mx / 90))
        }, 100)
      } catch { /* তরঙ্গ ছাড়াই রেকর্ড হবে */ }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => window.MediaRecorder?.isTypeSupported(t)) || ''
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.start(); mr.current = r; startAt.current = Date.now(); setRec({ secs: 0 })
      timer.current = setInterval(() => setRec({ secs: Math.round((Date.now() - startAt.current) / 1000) }), 500)
    } catch { cb.current.onError?.('মাইক্রোফোন ব্যবহারের অনুমতি দিন') }
  }, [])

  const stop = useCallback((shouldSend) => {
    const r = mr.current; if (!r) return
    clearInterval(timer.current); clearInterval(peakTimer.current)
    try { peakCtx.current?.close() } catch { /* ignore */ }
    const peaks = toBars(peakBuf.current)
    const duration = Math.round((Date.now() - startAt.current) / 1000)
    r.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop())
      if (shouldSend && duration >= 1) {
        const base = (r.mimeType || 'audio/webm').split(';')[0]
        const ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm'
        cb.current.onFinish?.(new File([new Blob(chunks.current, { type: base })], `voice-${Date.now()}.${ext}`, { type: base }), { duration, peaks })
      }
    }
    r.stop(); mr.current = null; setRec(null)
  }, [])

  useEffect(() => () => {
    clearInterval(timer.current); clearInterval(peakTimer.current)
    try { peakCtx.current?.close() } catch { /* ignore */ }
    mr.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  return { rec, start, stop }
}
