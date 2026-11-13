import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { mmss } from '../lib/media'
import Avatar from '../components/Avatar'

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
  const startRing = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = () => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.frequency.value = 480; g.gain.value = 0.15
        o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.4)
      }
      beep()
      const iv = setInterval(() => { beep(); navigator.vibrate?.([300, 200, 300]) }, 1500)
      ring.current = { ctx, iv }
    } catch { /* ignore */ }
  }
  const stopRing = () => {
    if (ring.current) { clearInterval(ring.current.iv); ring.current.ctx.close?.(); ring.current = null }
  }

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
    setCallState(null); setMuted(false); setCamOff(false); setSecs(0)
  }

  const becomeActive = () => {
    const c = callRef.current
    if (!c || c.state === 'active') return
    clearTimeout(ringTimer.current)
    setCall({ ...c, state: 'active', startedAt: Date.now() })
    clock.current = setInterval(() => setSecs((s) => s + 1), 1000)
  }

  const getMedia = (kind) => navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' ? { facingMode: 'user' } : false })

  const makePC = (peerId) => {
    const p = new RTCPeerConnection(ICE)
    pc.current = p
    local.current.getTracks().forEach((t) => p.addTrack(t, local.current))
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
    try { local.current = await getMedia(kind) } catch { return alert('মাইক্রোফোন' + (kind === 'video' ? '/ক্যামেরা' : '') + ' ব্যবহারের অনুমতি দিন।') }
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, receiver_id: peer.id, type: 'call',
      content: kind === 'video' ? '📹 ভিডিও কল করছেন' : '📞 অডিও কল করছেন', meta: { kind, status: 'calling' },
    }).select().single()
    if (error) { local.current.getTracks().forEach((t) => t.stop()); return alert('কল করা যায়নি — শুধু বন্ধুদের কল করা যায়।') }
    setCall({ peer, kind, dir: 'out', state: 'ringing', msgId: data.id })
    makePC(peer.id)
    sendTo(peer.id, 'invite', { name: profile.full_name, avatar: profile.avatar_url, kind })
    ringTimer.current = setTimeout(() => finish('missed'), 45000)
  }

  // ---------- কল ধরা/ফেরানো (কলি) ----------
  const accept = async () => {
    const c = callRef.current
    if (!c) return
    stopRing()
    try { local.current = await getMedia(c.kind) } catch { alert('মাইক্রোফোন/ক্যামেরার অনুমতি দিন।'); return finish('declined') }
    setCall({ ...c, state: 'connecting' })
    makePC(c.peer.id)
    sendTo(c.peer.id, 'accept')
  }
  const decline = () => finish('declined')
  const hangup = () => finish(callRef.current?.state === 'active' ? 'ended' : 'missed')

  // ---------- ইনকামিং ইভেন্ট ----------
  handleRef.current = async (event, p) => {
    const c = callRef.current
    if (event === 'invite') {
      if (c) return sendTo(p.from, 'busy')
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
  const Btn = ({ onClick, className, children }) => (
    <button onClick={onClick} className={`grid h-16 w-16 place-items-center rounded-full ${className}`}>{children}</button>
  )

  return (
    <Ctx.Provider value={{ startCall, inCall: !!call }}>
      {children}
      {call && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-ink text-white">
          <video ref={remoteEl} autoPlay playsInline className={isVideo && call.state === 'active' ? 'absolute inset-0 h-full w-full object-cover' : 'absolute h-px w-px opacity-0'} />
          {isVideo && local.current && (
            <video ref={localEl} autoPlay playsInline muted className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 h-40 w-28 rounded-2xl object-cover ring-2 ring-white/30 [transform:scaleX(-1)]" />
          )}
          {!showCenter && (
            <div className="relative z-10 mt-[max(1rem,env(safe-area-inset-top))] px-5">
              <p className="font-bold drop-shadow">{call.peer.full_name}</p><p className="text-sm text-white/80 drop-shadow">{status}</p>
            </div>
          )}
          {showCenter && (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
              <Avatar p={call.peer} size={128} />
              <h2 className="text-2xl font-extrabold">{call.peer.full_name}</h2>
              <p className="text-white/70">{status}</p>
            </div>
          )}
          {!showCenter && <div className="flex-1" />}
          <div className="relative z-10 flex items-center justify-center gap-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6">
            {call.dir === 'in' && call.state === 'ringing' ? (<>
              <Btn onClick={decline} className="bg-red-500"><PhoneOff size={28} /></Btn>
              <Btn onClick={accept} className="bg-emerald-500"><Phone size={28} /></Btn>
            </>) : (<>
              <Btn onClick={toggleMic} className={muted ? 'bg-white text-ink' : 'bg-white/20'}>{muted ? <MicOff size={26} /> : <Mic size={26} />}</Btn>
              {isVideo && <Btn onClick={toggleCam} className={camOff ? 'bg-white text-ink' : 'bg-white/20'}>{camOff ? <VideoOff size={26} /> : <Video size={26} />}</Btn>}
              <Btn onClick={hangup} className="bg-red-500"><PhoneOff size={28} /></Btn>
            </>)}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
