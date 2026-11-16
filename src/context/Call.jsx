import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Lock, Minimize2, SwitchCamera, Sparkles, Smile } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { mmss } from '../lib/media'
import Avatar from '../components/Avatar'

import { ringtone } from '../lib/sound'
import { ICE } from '../lib/rtc'
import { useLocalMedia, mediaMsg } from '../lib/useLocalMedia'
import { EffectsTray, ReactBar, Floaters, useFloaters, useDrag } from '../components/call/CallParts'

const Ctx = createContext(null)
export const useCall = () => useContext(Ctx)

export function CallProvider({ children }) {
  const { user, profile } = useAuth()
  const [call, setCallState] = useState(null) // {peer, kind, dir, state, msgId, startedAt}
  const [tick, setTick] = useState(0)
  const [secs, setSecs] = useState(0)
  const [note, setNote] = useState('')
  const [mini, setMini] = useState(false)
  const [swap, setSwap] = useState(false)          // true = নিজের ভিডিও বড়, অপরজনের ছোট
  const [showFx, setShowFx] = useState(false)
  const [showReact, setShowReact] = useState(false)
  const [upAsk, setUpAsk] = useState(false)        // অপরজন ভিডিওতে যেতে চাইছে (পপ-আপ)
  const [upWait, setUpWait] = useState(false)      // আমি ভিডিওতে যেতে চেয়েছি
  const [floats, addFloat] = useFloaters()
  const [dragStyle, drag] = useDrag()
  const callRef = useRef(null), pc = useRef(null), remote = useRef(null)
  const lm = useLocalMedia(() => (pc.current ? [pc.current] : []))
  const local = lm.stream
  const { muted, camOff, facing } = lm
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
    lm.release()
    remote.current = null; pending.current = []
    setTimeout(() => { Object.values(chans.current).forEach((x) => supabase.removeChannel(x.ch)); chans.current = {} }, 800)
    setCallState(null); setSecs(0); setNote(''); setMini(false); setSwap(false); setShowFx(false); setShowReact(false); setUpAsk(false); setUpWait(false)
  }

  const becomeActive = () => {
    const c = callRef.current
    if (!c || c.state === 'active') return
    clearTimeout(ringTimer.current); stopRing()
    setCall({ ...c, state: 'active', startedAt: Date.now() })
    clock.current = setInterval(() => setSecs((s) => s + 1), 1000)
  }

  const makePC = (peerId, kind) => {
    const p = new RTCPeerConnection(ICE)
    pc.current = p
    if (local.current) local.current.getTracks().forEach((t) => p.addTrack(t, local.current))
    // নিজের মাইক/ক্যামেরা না থাকলেও অপর পক্ষের অডিও-ভিডিও যেন আসে
    if (!local.current?.getAudioTracks().length) p.addTransceiver('audio', { direction: 'recvonly' })
    if (kind === 'video' && !local.current?.getVideoTracks().length) p.addTransceiver('video', { direction: 'recvonly' })
    p.onicecandidate = (e) => e.candidate && sendTo(peerId, 'ice', { candidate: e.candidate })
    p.ontrack = (e) => {
      if (!remote.current) remote.current = e.streams[0] || new MediaStream([e.track])
      else if (!remote.current.getTracks().includes(e.track)) remote.current.addTrack(e.track)
      e.track.onunmute = () => setTick((t) => t + 1)
      setTick((t) => t + 1)
    }
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
    try { m = await lm.acquire(kind) } catch (e) { return alert(mediaMsg(e, kind)) }
    setNote(m.note || '')
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, receiver_id: peer.id, type: 'call',
      content: kind === 'video' ? '📹 ভিডিও কল করছেন' : '📞 অডিও কল করছেন', meta: { kind, status: 'calling' },
    }).select().single()
    if (error) { lm.release(); setNote(''); return alert('কল করা যায়নি — শুধু বন্ধুদের কল করা যায়।') }
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
    try { m = await lm.acquire(c.kind) } catch (e) { alert(mediaMsg(e, c.kind)); return finish('declined') }
    setNote(m.note || '')
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
    } else if (event === 'vreq') {            // অপরজন অডিও থেকে ভিডিওতে যেতে চায়
      if (c.kind !== 'video') { setMini(false); setUpAsk(true) }
    } else if (event === 'vok') {             // আমার অনুরোধ গ্রহণ করা হয়েছে
      setUpWait(false); await addVideoToCall(); 
      const offer = await pc.current.createOffer(); await pc.current.setLocalDescription(offer)
      sendTo(c.peer.id, 'offer', { sdp: offer })
    } else if (event === 'vno') {
      setUpWait(false); setNote('ভিডিও কলে যেতে রাজি হননি'); setTimeout(() => setNote(''), 4000)
    } else if (event === 'react') { addFloat(p.e)
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
  }, [tick, call?.state, call?.kind, lm.hasVideo, swap])

  // কলের মাঝে ক্যামেরা চালু করে কানেকশনে যোগ (ক্যামেরা না পেলে শুধু দেখতে পাবে)
  const addVideoToCall = async () => {
    const c = callRef.current
    const t = await lm.addVideo()
    if (t) pc.current.addTrack(t, lm.stream.current)
    else { pc.current.addTransceiver('video', { direction: 'recvonly' }); setNote('ক্যামেরা চালু করা যায়নি — আপনি শুধু অপরজনকে দেখবেন') }
    setCall({ ...c, kind: 'video' })
  }
  const requestVideo = () => {
    const c = callRef.current
    if (!c || c.kind === 'video' || upWait) return
    setUpWait(true); sendTo(c.peer.id, 'vreq')
    setTimeout(() => setUpWait(false), 30000)
  }
  const answerUpgrade = async (yes) => {
    const c = callRef.current
    setUpAsk(false)
    if (!yes) return sendTo(c.peer.id, 'vno')
    await addVideoToCall()
    sendTo(c.peer.id, 'vok')
  }
  const react = (e) => { addFloat(e); sendTo(callRef.current.peer.id, 'react', { e }) }
  const toggleMic = lm.toggleMic, toggleCam = lm.toggleCam

  const isVideo = call?.kind === 'video'
  const remoteHasVideo = !!remote.current?.getVideoTracks().some((t) => t.readyState === 'live')
  const showCenter = call && !(isVideo && call.state === 'active' && remoteHasVideo)
  const status = !call ? '' : call.state === 'active' ? mmss(secs)
    : call.state === 'connecting' ? 'কানেক্ট হচ্ছে…'
    : call.dir === 'out' ? 'রিং হচ্ছে…' : `${isVideo ? 'ভিডিও' : 'অডিও'} কল আসছে…`
  // WhatsApp-স্টাইল গোল বাটন + নিচে লেখা
  const Ctl = ({ onClick, icon: I, label, active, danger, big, disabled, small, busy }) => (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 disabled:opacity-40">
      <span className={`grid place-items-center rounded-full transition active:scale-90 ${big ? 'h-16 w-16' : small ? 'h-12 w-12' : 'h-14 w-14'} ${danger ? 'bg-[#e11d48] text-white' : active ? 'bg-white text-ink' : 'bg-white/15 text-white'} ${busy ? 'animate-pulse' : ''}`}><I size={big ? 28 : small ? 21 : 24} /></span>
      {label && <span className="text-sm text-white/90">{label}</span>}
    </button>
  )
  const ringingIn = call?.dir === 'in' && call?.state === 'ringing'
  const E2E = <p className="flex items-center justify-center gap-1.5 text-sm text-white/70"><Lock size={13} />এন্ড-টু-এন্ড এনক্রিপ্টেড</p>
  const active = call?.state === 'active'
  const hasLocalVideo = isVideo && lm.hasVideo
  // কোন ভিডিওটি বড়: কল চালু হলে ডিফল্টে অপরজন বড়; ছোটটিতে ট্যাপ করলে বদলে যায়। রিং হওয়ার সময় নিজের ক্যামেরা বড়।
  const localBig = hasLocalVideo && (!active || swap || !remoteHasVideo)
  const remoteBig = isVideo && active && remoteHasVideo && !swap
  const remoteSmall = isVideo && active && remoteHasVideo && swap
  const bigCls = 'absolute inset-0 h-full w-full object-cover'
  const smallCls = 'fixed z-30 h-44 w-32 cursor-pointer touch-none rounded-2xl object-cover shadow-soft ring-2 ring-white/50'
  const mirror = facing === 'user' ? '[transform:scaleX(-1)]' : ''
  const smallBind = { ...drag, onPointerUp: (e) => drag.onPointerUp(e, () => setSwap((v) => !v)) }

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
          {/* অপরজনের ভিডিও/অডিও */}
          <video ref={remoteEl} autoPlay playsInline className={remoteBig ? bigCls : remoteSmall ? smallCls : 'absolute h-px w-px opacity-0'} style={remoteSmall ? dragStyle : undefined} {...(remoteSmall ? smallBind : {})} />
          {/* নিজের ভিডিও */}
          {hasLocalVideo && <video ref={localEl} autoPlay playsInline muted className={`${localBig ? bigCls : smallCls} ${mirror}`} style={localBig ? undefined : dragStyle} {...(localBig ? {} : smallBind)} />}
          {isVideo && <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/50 to-transparent" />}
          <Floaters items={floats} />

          {/* উপরের বার */}
          <div className="relative z-10 flex items-start gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            {!ringingIn ? <button onClick={() => setMini(true)} aria-label="ছোট করুন" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/35 backdrop-blur"><Minimize2 size={19} /></button> : <span className="w-11" />}
            <div className="min-w-0 flex-1 text-center drop-shadow">
              <p className="truncate text-xl font-bold">{call.peer.full_name}</p>
              {E2E}
              {!showCenter && <p className="mt-0.5 text-sm text-white/80">{status}{note ? ` • ${note}` : ''}</p>}
            </div>
            <span className="w-11" />
          </div>

          {showCenter && !localBig && (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
              <div className={ringingIn || !active ? 'animate-pulse' : ''}><Avatar p={call.peer} size={168} /></div>
              <p className="text-lg text-white/80">{status}</p>
              {note && <p className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-300">{note}</p>}
            </div>
          )}
          {(!showCenter || localBig) && <div className="flex-1" />}

          {/* ভিডিওতে যাওয়ার অনুরোধ পপ-আপ */}
          {upAsk && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 px-6">
              <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center text-fg shadow-soft">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Video size={26} /></span>
                <h3 className="mt-3 text-lg font-bold">ভিডিও কলে যাবেন?</h3>
                <p className="mt-1 text-sm text-fg/65"><b>{call.peer.full_name}</b> অডিও কল থেকে ভিডিও কলে যেতে চাইছেন। গ্রহণ করলে আপনার ক্যামেরা চালু হবে।</p>
                <div className="mt-5 flex gap-3">
                  <button onClick={() => answerUpgrade(false)} className="btn-soft flex-1">না, থাক</button>
                  <button onClick={() => answerUpgrade(true)} className="btn-primary flex-1"><Video size={18} />ভিডিওতে যান</button>
                </div>
              </div>
            </div>
          )}
          {upWait && <p className="absolute inset-x-0 top-28 z-30 mx-auto w-fit rounded-full bg-black/55 px-4 py-1.5 text-sm backdrop-blur">অপরজনের উত্তরের অপেক্ষা…</p>}

          {showFx && isVideo && <EffectsTray value={lm.effect} onPick={(id) => lm.setEffect(id)} onClose={() => setShowFx(false)} />}
          {showReact && active && <ReactBar onReact={react} />}

          {ringingIn ? (
            <div className="relative z-10 flex items-center justify-center gap-16 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6">
              <Ctl onClick={decline} icon={PhoneOff} label="কেটে দিন" danger big />
              <Ctl onClick={accept} icon={isVideo ? Video : Phone} label="ধরুন" big />
            </div>
          ) : isVideo ? (
            <div className="relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-around rounded-full bg-black/45 px-2 py-2.5 backdrop-blur">
              <Ctl small onClick={lm.flip} icon={SwitchCamera} disabled={!lm.hasVideo} />
              <Ctl small onClick={toggleCam} icon={camOff ? VideoOff : Video} active={camOff} disabled={!lm.hasVideo} />
              {lm.canFx && <Ctl small onClick={() => { setShowFx((v) => !v); setShowReact(false) }} icon={Sparkles} active={showFx} disabled={!lm.hasVideo} />}
              <Ctl small onClick={() => { setShowReact((v) => !v); setShowFx(false) }} icon={Smile} active={showReact} disabled={!active} />
              <Ctl small onClick={toggleMic} icon={muted ? MicOff : Mic} active={muted} />
              <Ctl small onClick={hangup} icon={PhoneOff} danger />
            </div>
          ) : (
            <div className="relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] rounded-[32px] bg-black/35 px-4 py-6 backdrop-blur ring-1 ring-white/10">
              <div className="grid grid-cols-3 gap-y-6">
                <Ctl onClick={toggleMic} icon={muted ? MicOff : Mic} label={muted ? 'আনমিউট' : 'মিউট'} active={muted} />
                <Ctl onClick={requestVideo} icon={Video} label={upWait ? 'অপেক্ষা…' : 'ভিডিও'} busy={upWait} disabled={!active} />
                <Ctl onClick={hangup} icon={PhoneOff} label="কল শেষ" danger />
              </div>
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
