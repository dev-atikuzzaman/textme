import { useRef, useState } from 'react'
import { makeFx, fxSupported } from './videoFx'
import { toast } from './ui'

const gum = (c) => navigator.mediaDevices.getUserMedia(c)

export const mediaMsg = (e, kind) => {
  const what = kind === 'video' ? 'মাইক্রোফোন ও ক্যামেরা' : 'মাইক্রোফোন'
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError')
    return `${what}-এর অনুমতি বন্ধ করা আছে।\n\nঠিক করতে: ব্রাউজারের অ্যাড্রেস বারের বাঁ পাশের 🔒 (বা ⚙) আইকনে ক্লিক করে ${what} "Allow / অনুমতি দিন" করুন, তারপর পেজ রিফ্রেশ করে আবার চেষ্টা করুন।`
  if (e?.name === 'NotReadableError') return `${what} এখন অন্য কোনো অ্যাপ বা ট্যাব ব্যবহার করছে। সেটি বন্ধ করে আবার চেষ্টা করুন।`
  return `${what} চালু করা যায়নি (${e?.name || 'অজানা ত্রুটি'})।`
}

// কল (১-১ ও গ্রুপ) দুটোর জন্য একই লোকাল মাইক/ক্যামেরা ব্যবস্থাপনা:
// ক্যামেরা ঘোরানো, ইফেক্ট, মিউট, ক্যামেরা অন/অফ, কলের মাঝে ক্যামেরা যোগ
export function useLocalMedia(getPCs = () => []) {
  const stream = useRef(null)   // যা পাঠানো হচ্ছে (অডিও + আউটপুট ভিডিও)
  const raw = useRef(null)      // আসল ক্যামেরা ট্র্যাক
  const fx = useRef(null)
  const effectRef = useRef('none'), camOffRef = useRef(false)
  const [, setVer] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [facing, setFacing] = useState('user')
  const [effect, setEffectState] = useState('none')
  const [fxState, setFxState] = useState('')   // '' | loading | ready | failed (ব্যাকগ্রাউন্ড মডেল)
  const bump = () => setVer((v) => v + 1)

  // আউটপুট ভিডিও ট্র্যাক বদলে সব পিয়ারে replaceTrack
  const setOut = async (out) => {
    stream.current ||= new MediaStream()
    stream.current.getVideoTracks().forEach((t) => { stream.current.removeTrack(t); if (t !== out) t.stop() })
    stream.current.addTrack(out)
    out.enabled = !camOffRef.current
    for (const pc of getPCs()) {
      const s = pc.getSenders().find((x) => x.track?.kind === 'video') || pc.getTransceivers().find((t) => t.receiver.track.kind === 'video' && t.sender && !t.stopped)?.sender
      if (s) await s.replaceTrack(out).catch(() => {})
    }
    bump()
  }
  const swapInTrack = async (nt) => {
    fx.current?.stop(); fx.current = null
    raw.current = nt
    let out = nt
    if (effectRef.current !== 'none' && fxSupported()) { fx.current = makeFx(nt, effectRef.current, setFxState); out = fx.current.track }
    await setOut(out)
  }

  // কল শুরুতে: মাইক (+ক্যামেরা)। না পেলে যতটা সম্ভব।
  const acquire = async (kind) => {
    try {
      const s = await gum({ audio: true, video: kind === 'video' ? { facingMode: 'user' } : false })
      stream.current = s; raw.current = s.getVideoTracks()[0] || null; bump()
      return { note: '' }
    } catch (e) {
      let err = e
      if (kind === 'video' && ['NotFoundError', 'OverconstrainedError', 'NotReadableError'].includes(e.name)) {
        try { const s = await gum({ audio: true }); stream.current = s; bump(); return { note: 'ক্যামেরা পাওয়া যায়নি — অডিওতে চলছে' } } catch (e2) { err = e2 }
      }
      if (err.name === 'NotFoundError') { stream.current = null; return { note: 'মাইক্রোফোন পাওয়া যায়নি — আপনি শুধু শুনতে পারবেন' } }
      throw err
    }
  }
  // কলের মাঝে ক্যামেরা চালু (অডিও → ভিডিও)। সফল হলে ট্র্যাক ফেরত, নইলে null
  const addVideo = async () => {
    try {
      const s = await gum({ video: { facingMode: facing } })
      const nt = s.getVideoTracks()[0]
      raw.current = nt
      let out = nt
      if (effectRef.current !== 'none' && fxSupported()) { fx.current = makeFx(nt, effectRef.current, setFxState); out = fx.current.track }
      stream.current ||= new MediaStream()
      stream.current.addTrack(out); out.enabled = !camOffRef.current; bump()
      return out
    } catch { return null }
  }

  const flip = async () => {
    if (!raw.current) return false
    const next = facing === 'user' ? 'environment' : 'user'
    const old = raw.current
    fx.current?.stop(); fx.current = null
    old.stop() // মোবাইলে একসাথে দুটি ক্যামেরা খোলা যায় না — আগেরটি ছেড়ে দিতে হয়
    let s = null, ok = true
    try { s = await gum({ video: { facingMode: { exact: next } } }) } catch {
      try { s = await gum({ video: { facingMode: next } }) } catch {
        ok = false
        try { s = await gum({ video: { facingMode: facing } }) } catch { s = null }
      }
    }
    if (!s) { toast.error('ক্যামেরা বদলানো যায়নি'); return false }
    await swapInTrack(s.getVideoTracks()[0])
    if (ok) setFacing(next); else toast('এই ডিভাইসে আরেকটি ক্যামেরা পাওয়া যায়নি')
    return ok
  }

  const setEffect = async (id) => {
    effectRef.current = id; setEffectState(id)
    if (id !== 'none' && fx.current) { fx.current.setId(id); return } // চালু থাকলে শুধু ব্যাকগ্রাউন্ড বদলায়
    if (id === 'none') setFxState('')
    if (raw.current && raw.current.readyState === 'live') await swapInTrack(raw.current)
  }
  const toggleMic = () => { stream.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted) }
  const toggleCam = () => { camOffRef.current = !camOff; stream.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff) }

  const release = () => {
    fx.current?.stop(); fx.current = null
    stream.current?.getTracks().forEach((t) => t.stop()); raw.current?.stop()
    stream.current = null; raw.current = null
    effectRef.current = 'none'; camOffRef.current = false
    setMuted(false); setCamOff(false); setFacing('user'); setEffectState('none')
  }
  const hasVideo = !!stream.current?.getVideoTracks().length
  return { stream, raw, acquire, addVideo, flip, setEffect, toggleMic, toggleCam, release, muted, camOff, facing, effect, hasVideo, fxState, canFx: fxSupported() }
}
