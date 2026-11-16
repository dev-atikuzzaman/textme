import { useEffect, useRef, useState } from 'react'
import { X, SwitchCamera, Circle, Square, Check, RotateCcw } from 'lucide-react'

const MAX_REC = 60 // সেকেন্ড

// অ্যাপের ভেতরেই ক্যামেরা: ছবি তোলা ও ভিডিও রেকর্ড (চ্যাট, গ্রুপ, রিলস/ভিডিও)
// mode: 'photo' | 'video' | 'both'
export default function CameraSheet({ mode = 'both', onCapture, onClose }) {
  const [m, setM] = useState(mode === 'video' ? 'video' : 'photo')
  const [facing, setFacing] = useState('user')
  const [err, setErr] = useState('')
  const [rec, setRec] = useState(false)
  const [secs, setSecs] = useState(0)
  const [shot, setShot] = useState(null) // {file, url, type}
  const [ready, setReady] = useState(false)
  const vid = useRef(), stream = useRef(), recorder = useRef(), chunks = useRef([]), timer = useRef()

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  const open = async (face) => {
    stop(); setReady(false); setErr('')
    try {
      let s
      try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: m === 'video' }) }
      catch (e) { if (m === 'video' && e.name === 'NotFoundError') s = await navigator.mediaDevices.getUserMedia({ video: true }); else throw e }
      stream.current = s
      if (vid.current) { vid.current.srcObject = s; await vid.current.play().catch(() => {}) }
      setReady(true)
    } catch (e) {
      setErr(e.name === 'NotAllowedError' ? 'ক্যামেরার অনুমতি বন্ধ। ব্রাউজারের অ্যাড্রেস বারের 🔒 আইকনে ক্লিক করে ক্যামেরা/মাইক "Allow" করুন।' : e.name === 'NotFoundError' ? 'এই ডিভাইসে ক্যামেরা পাওয়া যায়নি।' : e.name === 'NotReadableError' ? 'ক্যামেরা এখন অন্য অ্যাপ ব্যবহার করছে।' : 'ক্যামেরা চালু করা যায়নি।')
    }
  }
  useEffect(() => { if (!shot) open(facing); return () => {} }, [facing, m, shot]) // eslint-disable-line
  useEffect(() => () => { stop(); clearInterval(timer.current) }, [])
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])

  const snap = () => {
    const v = vid.current; if (!v?.videoWidth) return
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1) } // সেলফি যেভাবে দেখা যায় সেভাবেই সেভ
    ctx.drawImage(v, 0, 0)
    c.toBlob((b) => {
      const file = new File([b], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      stop(); setShot({ file, url: URL.createObjectURL(b), type: 'image' })
    }, 'image/jpeg', 0.9)
  }
  const startRec = () => {
    if (!stream.current || !window.MediaRecorder) return setErr('এই ব্রাউজারে ভিডিও রেকর্ড সমর্থিত নয়')
    const mime = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || ''
    chunks.current = []
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined)
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    r.onstop = () => {
      const type = (r.mimeType || mime || 'video/webm').split(';')[0]
      const b = new Blob(chunks.current, { type })
      const file = new File([b], `video-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type })
      stop(); setShot({ file, url: URL.createObjectURL(b), type: 'video' })
    }
    r.start(500); recorder.current = r; setRec(true); setSecs(0)
    timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_REC) stopRec(); return s + 1 }), 1000)
  }
  const stopRec = () => { clearInterval(timer.current); setRec(false); if (recorder.current?.state === 'recording') recorder.current.stop() }
  const retake = () => { URL.revokeObjectURL(shot.url); setShot(null) }
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={() => { stopRec(); stop(); onClose() }} aria-label="বন্ধ" className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><X size={22} /></button>
        {rec && <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />{mmss(secs)}</span>}
        {!shot && !rec ? <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="ক্যামেরা ঘোরান" className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><SwitchCamera size={22} /></button> : <span className="w-11" />}
      </div>

      <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        {shot ? (shot.type === 'image' ? <img src={shot.url} alt="" className="max-h-full max-w-full object-contain" /> : <video src={shot.url} controls autoPlay playsInline className="max-h-full max-w-full" />)
          : <video ref={vid} playsInline muted className={`max-h-full max-w-full object-contain ${facing === 'user' ? '[transform:scaleX(-1)]' : ''}`} />}
        {err && <p className="absolute inset-x-6 rounded-2xl bg-black/70 p-4 text-center text-sm">{err}</p>}
        {!ready && !err && !shot && <p className="absolute text-white/70">ক্যামেরা চালু হচ্ছে…</p>}
      </div>

      <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {shot ? (
          <div className="flex items-center justify-center gap-10">
            <button onClick={retake} className="flex flex-col items-center gap-1.5"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/15"><RotateCcw size={24} /></span><span className="text-xs">আবার তুলুন</span></button>
            <button onClick={() => { onCapture(shot.file); onClose() }} className="flex flex-col items-center gap-1.5"><span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500"><Check size={30} /></span><span className="text-xs font-bold">ব্যবহার করুন</span></button>
          </div>
        ) : (
          <div className="space-y-4">
            {mode === 'both' && !rec && (
              <div className="flex justify-center gap-2">
                {[['photo', 'ছবি'], ['video', 'ভিডিও']].map(([k, l]) => <button key={k} onClick={() => setM(k)} className={`rounded-full px-5 py-1.5 text-sm font-bold ${m === k ? 'bg-white text-black' : 'text-white/70'}`}>{l}</button>)}
              </div>
            )}
            <div className="flex items-center justify-center">
              {m === 'photo'
                ? <button disabled={!ready} onClick={snap} aria-label="ছবি তুলুন" className="grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-40"><span className="h-14 w-14 rounded-full bg-white transition active:scale-90" /></button>
                : rec
                  ? <button onClick={stopRec} aria-label="রেকর্ড থামান" className="grid h-20 w-20 place-items-center rounded-full border-4 border-white"><Square size={28} className="fill-red-500 text-red-500" /></button>
                  : <button disabled={!ready} onClick={startRec} aria-label="রেকর্ড শুরু" className="grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-40"><Circle size={52} className="fill-red-500 text-red-500" /></button>}
            </div>
            {m === 'video' && <p className="text-center text-xs text-white/60">সর্বোচ্চ {MAX_REC} সেকেন্ড</p>}
          </div>
        )}
      </div>
    </div>
  )
}
