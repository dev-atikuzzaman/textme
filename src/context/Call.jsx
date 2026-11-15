import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Lock, Minimize2, SwitchCamera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { mmss } from '../lib/media'
import Avatar from '../components/Avatar'

import { ringtone } from '../lib/sound'

const Ctx = createContext(null)
export const useCall = () => useContext(Ctx)

// STUN ফ্রি। মোবাইল ডেটা/কড়া নেটওয়ার্কে কল ধরতে TURN সার্ভার লাগে (ঐচ্ছিক env)
const turn = import.meta.env.VITE_TURN_URL
const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ...(turn ? [{ urls: turn.split(','), username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }] : []),
  ],
}

export function CallProvider({ children }) {
  const { user, profile } = useAuth()
  const [call, setCallState] = useState(null) // {peer, kind, dir, state, msgId, startedAt}
  const [tick, setTick] = useState(0)
  const [secs, setSecs] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [note, setNote] = useState('')
  const [mini, setMini] = useState(false)
  const [facing, setFacing] = useState('user')
  const callRef = useRef(null), pc = useRef(null), local = useRef(null), remote = useRef(null)
  const chans = useRef({}), pending = useRef([]), ringTimer = useRef(), clock = useRef(), ring = useRef()
  const remoteEl = useRef(), localEl = useRef(), handleRef = useRef()
  const setCall = (v) => { callRef.current = v; setCallState(v) }

  // ---------- সিগন্যালিং (Supabase Realtime Broadcast) ----------
  const getChan = (id) => {
    if (!chans.current[id]) {
      const ch = supabase.channel(`call-${id}`)
      chans.current[id] = { ch, ready: new Promise((r) => ch.subscribe((s) => s === 'SUBSCRIBED' && r())) }
    }
    return chans.current[id]
  }
  const sendTo = async (id, event, payload = {}) => {
    const c = getChan(id)
    await c.ready
    c.ch.send({ type: 'broadcast', event, payload: { ...payload, from: user.id } })
  }

  // ---------- রিংটোন ----------
  // শেয়ার্ড (আনলক করা) AudioContext দিয়ে বাজে, তাই ইনকামিং কলে সাউন্ডসহ রিং হয়
  const startRing = (mode = 'in') => { stopRing(); ring.current = ringtone(mode) }
  const stopRing = () => { ring.current?.(); ring.current = null }

  // ---------- কল শেষ/পরিষ্কার ----------
  const finish = async (status, notify = true) => {
    const c = callRef.current
    if (!c) return
    callRef.current = null
    if (notify) sendTo(c.peer.id, status === 'declined' ? 'reject' : 'end')
    clearTimeout(ringTimer.current); clearInterval(clock.current); stopRing()
    if (c.dir === 'out' && c.msgId) {
      const duration = c.startedAt ? Math.round((Date.now() - c.startedAt) / 1000) : 0
      await supabase.from('messages').update({ meta: { kind: c.kind, status, duration } }).eq('id', c.msgId)
    }
    pc.current?.close(); pc.current = null
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null
    remote.current = null; pending.current = []
    setTimeout(() => { Object.values(chans.current).forEach((x) => supabase.removeChannel(x.ch)); chans.current = {} }, 800)
    setCallState(null); setMuted(false); setCamOff(false); setSecs(0); setNote(''); setMini(false); setFacing('user')
  }

  const becomeActive = () => {
    const c = callRef.current
    if (!c || c.state === 'active') return
    clearTimeout(ringTimer.current); stopRing()
    setCall({ ...c, state: 'active', startedAt: Date.now() })
    clock.current = setInterval(() => setSecs((s) => s + 1), 1000)
  }

  // মাইক/ক্যামেরা: না পেলে কল বাতিল না করে যতটা সম্ভব চালিয়ে যায়
  const getMedia = async (kind) => {
    const get = (c) => navigator.mediaDevices.getUserMedia(c)
    try {
      return { stream: await get({ audio: true, video: kind === 'video' ? { facingMode: 'user' } : false }) }
    } catch (e) {
      let err = e
      if (kind === 'video' && ['NotFoundError', 'OverconstrainedError', 'NotReadableError'].includes(e.name)) {
        try { return { stream: await get({ audio: true }), note: 'ক্যামেরা পাওয়া যায়নি — অডিওতে চলছে' } } catch (e2) { err = e2 }
      }
      if (err.name === 'NotFoundError') return { stream: null, note: 'মাইক্রোফোন পাওয়া যায়নি — আপনি শুধু শুনতে পারবেন' }
      throw err
    }
  }
  const mediaMsg = (e, kind) => {
    const what = kind === 'video' ? 'মাইক্রোফোন ও ক্যামেরা' : 'মাইক্রোফোন'
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError')
      return `${what}-এর অনুমতি বন্ধ করা আছে।\n\nঠিক করতে: ব্রাউজারের অ্যাড্রেস বারের বাঁ পাশের 🔒 (বা ⚙) আইকনে ক্লিক করে ${what} "Allow / অনুমতি দিন" করুন, তারপর পেজ রিফ্রেশ করে আবার কল দিন।`
    if (e?.name === 'NotReadableError') return `${what} এখন অন্য কোনো অ্যাপ বা ট্যাব ব্যবহার করছে। সেটি বন্ধ করে আবার চেষ্টা করুন।`
    return `${what} চালু করা যায়নি (${e?.name || 'অজানা ত্রুটি'})।`
  }

  const makePC = (peerId, kind) => {
    const p = new RTCPeerConnection(ICE)
    pc.current = p
    if (local.current) local.current.getTracks().forEach((t) => p.addTrack(t, local.current))
    // নিজের মাইক/ক্যামেরা না থাকলেও অপর পক্ষের অডিও-ভিডিও যেন আসে
    if (!local.current?.getAudioTracks().length) p.addTransceiver('audio', { direction: 'recvonly' })
    if (kind === 'video' && !local.current?.getVideoTracks().length) p.addTransceiver('video', { direction: 'recvonly' })
    p.onicecandidate = (e) => e.candidate && sendTo(peerId, 'ice', { candidate: e.candidate })
    p.ontrack = (e) => { remote.current = e.streams[0]; setTick((t) => t + 1) }
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') becomeActive()
      if (p.connectionState === 'failed') finish('ended')
    }
  }
  const flushIce = async () => {
    for (const c of pending.current) await pc.current.addIceCandidate(c).catch(() => {})
    pending.current = []
  }

  // ---------- কল শুরু (কলার) ----------
  const startCall = async (peer, kind) => {
    if (callRef.current) return
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return alert('এই ব্রাউজারে কল সমর্থিত নয়।')
    let m
    try { m = await getMedia(kind) } catch (e) { return alert(mediaMsg(e, kind)) }
    local.current = m.stream; setNote(m.note || '')
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, receiver_id: peer.id, type: 'call',
      content: kind === 'video' ? '📹 ভিডিও কল করছেন' : '📞 অডিও কল করছেন', meta: { kind, status: 'calling' },
    }).select().single()
    if (error) { local.current?.getTracks().forEach((t) => t.stop()); local.current = null; setNote(''); return alert('কল করা যায়নি — শুধু বন্ধুদের কল করা যায়।') }
    setCall({ peer, kind, dir: 'out', state: 'ringing', msgId: data.id })
    makePC(peer.id, kind)
    startRing('out') // কলার রিংব্যাক টোন শোনে
    sendTo(peer.id, 'invite', { name: profile.full_name, avatar: profile.avatar_url, kind })
    ringTimer.current = setTimeout(() => finish('missed'), 45000)
  }

  // ---------- কল ধরা/ফেরানো (কলি) ----------
  const accept = async () => {
    const c = callRef.current
    if (!c) return
    stopRing()
    let m
    try { m = await getMedia(c.kind) } catch (e) { alert(mediaMsg(e, c.kind)); return finish('declined') }
    local.current = m.stream; setNote(m.note || '')
    setCall({ ...c, state: 'connecting' })
    makePC(c.peer.id, c.kind)
    sendTo(c.peer.id, 'accept')
  }
  const decline = () => finish('declined')
  const hangup = () => finish(callRef.current?.state === 'active' ? 'ended' : 'missed')

  // ---------- ইনকামিং ইভেন্ট ----------
  handleRef.current = async (event, p) => {
    const c = callRef.current
    if (event === 'invite') {
      if (c) { if (c.dir === 'in' && c.peer.id === p.from) return; return sendTo(p.from, 'busy') }
      const { data: ok } = await supabase.rpc('are_friends', { a: user.id, b: p.from })
      if (!ok) return
      setCall({ peer: { id: p.from, full_name: p.name, avatar_url: p.avatar }, kind: p.kind, dir: 'in', state: 'ringing' })
      startRing()
      ringTimer.current = setTimeout(() => finish('missed', false), 45000)
      return
    }
    if (!c || p.from !== c.peer.id) return
    if (event === 'accept') {
      setCall({ ...c, state: 'connecting' })
      const offer = await pc.current.createOffer()
      await pc.current.setLocalDescription(offer)
      sendTo(c.peer.id, 'offer', { sdp: offer })
    } else if (event === 'offer') {
      await pc.current.setRemoteDescription(p.sdp)
      await flushIce()
      const ans = await pc.current.createAnswer()
      await pc.current.setLocalDescription(ans)
      sendTo(c.peer.id, 'answer', { sdp: ans })
    } else if (event === 'answer') {
      await pc.current.setRemoteDescription(p.sdp)
      await flushIce()
    } else if (event === 'ice') {
      if (pc.current?.remoteDescription) pc.current.addIceCandidate(p.candidate).catch(() => {})
      else pending.current.push(p.candidate)
    } else if (event === 'reject') finish('declined', false)
    else if (event === 'busy') finish('busy', false)
    else if (event === 'end') finish(c.state === 'active' ? 'ended' : 'missed', false)
  }

  // অ্যাপ বন্ধ থাকলে লাইভ "invite" মিস হয়। নোটিফিকেশন ট্যাপ করে অ্যাপ খুললে
  // ডাটাবেসে থাকা সাম্প্রতিক "calling" কলটি ধরে রিং দেখানো হয় (৪০ সেকেন্ডের মধ্যে)।
  const pickRef = useRef()
  pickRef.current = async () => {
    if (callRef.current || document.hidden) return
    const since = new Date(Date.now() - 40000).toISOString()
    const { data } = await supabase.from('messages').select('id,sender_id,meta,created_at')
      .eq('receiver_id', user.id).eq('type', 'call').gte('created_at', since).order('created_at', { ascending: false }).limit(1)
    const m = data?.[0]
    if (!m || m.meta?.status !== 'calling' || callRef.current) return
    const { data: peer } = await supabase.from('profiles').select('id,full_name,avatar_url').eq('id', m.sender_id).single()
    if (!peer || callRef.current) return
    setCall({ peer, kind: m.meta.kind, dir: 'in', state: 'ringing' })
    startRing()
    ringTimer.current = setTimeout(() => finish('missed', false), Math.max(3000, 45000 - (Date.now() - new Date(m.created_at).getTime())))
  }
  useEffect(() => {
    const onVis = () => { if (!document.hidden) pickRef.current() }
    document.addEventListener('visibilitychange', onVis)
    const t = setTimeout(() => pickRef.current(), 1200)
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(t) }
  }, [user.id])

  useEffect(() => {
    const ch = supabase.channel(`call-${user.id}`)
      .on('broadcast', { event: '*' }, ({ event, payload }) => handleRef.current(event, payload))
      .subscribe()
    return () => { supabase.removeChannel(ch); finish('ended') }
    // eslint-disable-next-line
  }, [user.id])

  useEffect(() => {
    if (remoteEl.current && remote.current) remoteEl.current.srcObject = remote.current
    if (localEl.current && local.current) localEl.current.srcObject = local.current
  }, [tick, call?.state, call?.kind])

  const toggleMic = () => { local.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted) }
  const toggleCam = () => { local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff) }

  const isVideo = call?.kind === 'video'
  const showCenter = call && !(isVideo && call.state === 'active')
  const status = !call ? '' : call.state === 'active' ? mmss(secs)
    : call.state === 'connecting' ? 'কানেক্ট হচ্ছে…'
    : call.dir === 'out' ? 'রিং হচ্ছে…' : `${isVideo ? 'ভিডিও' : 'অডিও'} কল আসছে…`
  const flip = async () => {
    const sender = pc.current?.getSenders().find((x) => x.track?.kind === 'video')
    if (!sender || !local.current) return
    try {
      const next = facing === 'user' ? 'environment' : 'user'
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next } })
      const nt = st.getVideoTracks()[0]
      await sender.replaceTrack(nt)
      local.current.getVideoTracks().forEach((t) => { t.stop(); local.current.removeTrack(t) })
      local.current.addTrack(nt)
      if (localEl.current) localEl.current.srcObject = local.current
      setFacing(next); setCamOff(false)
    } catch { /* একটাই ক্যামেরা থাকলে কিছু হবে না */ }
  }

  // WhatsApp-স্টাইল গোল বাটন + নিচে লেখা
  const Ctl = ({ onClick, icon: I, label, active, danger, big, disabled }) => (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 disabled:opacity-40">
      <span className={`grid place-items-center rounded-full transition active:scale-90 ${big ? 'h-16 w-16' : 'h-14 w-14'} ${danger ? 'bg-[#e11d48] text-white' : active ? 'bg-white text-ink' : 'bg-white/10 text-white'}`}><I size={big ? 28 : 24} /></span>
      {label && <span className="text-sm text-white/90">{label}</span>}
    </button>
  )
  const ringingIn = call?.dir === 'in' && call?.state === 'ringing'
  const E2E = <p className="flex items-center justify-center gap-1.5 text-sm text-white/70"><Lock size={13} />এন্ড-টু-এন্ড এনক্রিপ্টেড</p>

  return (
    <Ctx.Provider value={{ startCall, inCall: !!call }}>
      {children}
      {call && mini && (
        <button onClick={() => setMini(false)} className="fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#0b3d2e] py-1.5 pl-1.5 pr-4 text-white shadow-soft ring-1 ring-white/15">
          <Avatar p={call.peer} size={34} />
          <span className="text-left text-sm leading-tight"><b className="block max-w-[9rem] truncate">{call.peer.full_name}</b><span className="text-xs text-white/70">{status}</span></span>
          <span onClick={(e) => { e.stopPropagation(); hangup() }} className="grid h-8 w-8 place-items-center rounded-full bg-[#e11d48]"><PhoneOff size={16} /></span>
        </button>
      )}
      {call && (
        <div className={mini ? 'pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0' : 'fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#0b1f1a] to-[#07120f] text-white'}>
          <video ref={remoteEl} autoPlay playsInline className={isVideo && call.state === 'active' ? 'absolute inset-0 h-full w-full object-cover' : 'absolute h-px w-px opacity-0'} />
          {isVideo && local.current?.getVideoTracks().length > 0 && (
            <video ref={localEl} autoPlay playsInline muted className={`absolute bottom-40 right-4 z-10 h-40 w-28 rounded-2xl object-cover ring-2 ring-white/30 ${facing === 'user' ? '[transform:scaleX(-1)]' : ''}`} />
          )}

          {/* উপরের বার: মিনিমাইজ + নাম + E2E লেখা */}
          <div className="relative z-10 flex items-start gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            {!ringingIn ? <button onClick={() => setMini(true)} aria-label="ছোট করুন" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/35 backdrop-blur"><Minimize2 size={19} /></button> : <span className="w-11" />}
            <div className="min-w-0 flex-1 text-center drop-shadow">
              <p className="truncate text-xl font-bold">{call.peer.full_name}</p>
              {E2E}
              {(showCenter ? false : true) && <p className="mt-0.5 text-sm text-white/80">{status}{note ? ` • ${note}` : ''}</p>}
            </div>
            <span className="w-11" />
          </div>

          {showCenter && (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
              <div className={ringingIn || call.state !== 'active' ? 'animate-pulse' : ''}><Avatar p={call.peer} size={168} /></div>
              <p className="text-lg text-white/80">{status}</p>
              {note && <p className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-300">{note}</p>}
            </div>
          )}
          {!showCenter && <div className="flex-1" />}

          {ringingIn ? (
            <div className="relative z-10 flex items-center justify-center gap-16 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6">
              <Ctl onClick={decline} icon={PhoneOff} label="কেটে দিন" danger big />
              <Ctl onClick={accept} icon={isVideo ? Video : Phone} label="ধরুন" big />
            </div>
          ) : isVideo && call.state === 'active' ? (
            <div className="relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-around rounded-full bg-black/45 px-3 py-3 backdrop-blur">
              <Ctl onClick={flip} icon={SwitchCamera} />
              <Ctl onClick={toggleCam} icon={camOff ? VideoOff : Video} active={camOff} />
              <Ctl onClick={toggleMic} icon={muted ? MicOff : Mic} active={muted} />
              <Ctl onClick={hangup} icon={PhoneOff} danger />
            </div>
          ) : (
            <div className="relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] rounded-[32px] bg-black/35 px-4 py-6 backdrop-blur ring-1 ring-white/10">
              <div className="grid grid-cols-3 gap-y-6">
                <Ctl onClick={toggleMic} icon={muted ? MicOff : Mic} label={muted ? 'আনমিউট' : 'মিউট'} active={muted} />
                {isVideo ? <Ctl onClick={toggleCam} icon={camOff ? VideoOff : Video} label="ক্যামেরা" active={camOff} /> : <Ctl icon={Video} label="ভিডিও" disabled />}
                <Ctl onClick={hangup} icon={PhoneOff} label="কল শেষ" danger />
              </div>
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
