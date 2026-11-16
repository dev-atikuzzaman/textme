import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Lock, Minimize2, SwitchCamera, Sparkles, Smile, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './Auth'
import { mmss } from '../lib/media'
import { ICE } from '../lib/rtc'
import { ringtone } from '../lib/sound'
import { useLocalMedia, mediaMsg } from '../lib/useLocalMedia'
import Avatar from '../components/Avatar'
import { EffectsTray, ReactBar, Floaters, useFloaters } from '../components/call/CallParts'

// গ্রুপ কল: মেশ WebRTC (প্রত্যেকে প্রত্যেকের সাথে সরাসরি) — সর্বোচ্চ ৬ জন।
// ঘর = Supabase Realtime channel "gcall:<গ্রুপ-id>": presence = কে কলে আছে, broadcast = সিগন্যাল।
const Ctx = createContext(null)
export const useGroupCall = () => useContext(Ctx)
export const MAX_GROUP_CALL = 6

export function useGroupLive(gid) {
  const g = useContext(Ctx)
  useEffect(() => (gid && g ? g.watch(gid) : undefined), [gid]) // eslint-disable-line
  return g?.live[gid] || []
}

function Tile({ stream, name, avatar, local, mirror, big }) {
  const ref = useRef()
  const [, tick] = useState(0)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null
    const t = stream?.getVideoTracks?.()[0]
    if (t) { t.onunmute = () => tick((x) => x + 1); t.onmute = () => tick((x) => x + 1) }
  })
  const showVideo = !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled && !t.muted)
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-[#10241e] ${big ? 'col-span-2' : ''}`}>
      <video ref={ref} autoPlay playsInline muted={!!local} className={`h-full w-full object-cover ${mirror ? '[transform:scaleX(-1)]' : ''} ${showVideo ? '' : 'invisible'}`} />
      {!showVideo && <div className="absolute inset-0 grid place-items-center"><Avatar p={{ full_name: name, avatar_url: avatar }} size={72} /></div>}
      <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-black/50 px-2.5 py-0.5 text-xs text-white">{local ? 'আপনি' : name}</span>
    </div>
  )
}

export function GroupCallProvider({ children }) {
  const { user, profile } = useAuth()
  const [gc, setGc] = useState(null)             // {group, kind}
  const [live, setLive] = useState({})            // gid -> [{id,name,avatar}]
  const [tiles, setTiles] = useState({})          // peerId -> {stream,name,avatar}
  const [ring, setRing] = useState(null)          // ইনকামিং আমন্ত্রণ
  const [secs, setSecs] = useState(0)
  const [mini, setMini] = useState(false)
  const [showFx, setShowFx] = useState(false)
  const [showReact, setShowReact] = useState(false)
  const [floats, addFloat] = useFloaters()
  const rooms = useRef({})                        // gid -> {ch, ready, refs}
  const pcs = useRef({})                          // peerId -> {pc, pending: []}
  const gcRef = useRef(null), myAt = useRef(0), clock = useRef(), stopRing = useRef()
  const lm = useLocalMedia(() => Object.values(pcs.current).map((x) => x.pc))

  const presenceList = (gid) => {
    const st = rooms.current[gid]?.ch.presenceState() || {}
    return Object.values(st).map((arr) => arr[0]).filter(Boolean)
  }

  // ---------- ঘর (channel) ----------
  const ensureRoom = (gid) => {
    let r = rooms.current[gid]
    if (r) return r
    const ch = supabase.channel(`gcall:${gid}`, { config: { presence: { key: user.id }, broadcast: { self: false } } })
    r = { ch, refs: 0, ready: null }
    rooms.current[gid] = r
    ch.on('presence', { event: 'sync' }, () => {
      const list = presenceList(gid)
      setLive((l) => ({ ...l, [gid]: list.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar })) }))
      if (gcRef.current?.group.id === gid) reconcile(list)
    })
    ch.on('broadcast', { event: 'sig' }, ({ payload }) => { if (payload.to === user.id) onSig(gid, payload) })
    ch.on('broadcast', { event: 'react' }, ({ payload }) => addFloat(payload.e))
    r.ready = new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()))
    return r
  }
  const closeRoomIfIdle = (gid) => {
    const r = rooms.current[gid]
    if (r && r.refs <= 0 && gcRef.current?.group.id !== gid) { supabase.removeChannel(r.ch); delete rooms.current[gid]; setLive((l) => { const n = { ...l }; delete n[gid]; return n }) }
  }
  const watch = useCallback((gid) => {
    const r = ensureRoom(gid); r.refs++
    return () => { r.refs--; closeRoomIfIdle(gid) }
    // eslint-disable-next-line
  }, [user.id])

  const sig = (gid, to, t, d) => rooms.current[gid]?.ch.send({ type: 'broadcast', event: 'sig', payload: { to, from: user.id, t, d } })

  // ---------- পিয়ার সংযোগ ----------
  const makePeer = (gid, peerId, meta) => {
    if (pcs.current[peerId]) return pcs.current[peerId]
    const pc = new RTCPeerConnection(ICE)
    const entry = { pc, pending: [] }
    pcs.current[peerId] = entry
    lm.stream.current?.getTracks().forEach((t) => pc.addTrack(t, lm.stream.current))
    if (!lm.stream.current?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' })
    if (gcRef.current?.kind === 'video' && !lm.stream.current?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' })
    pc.onicecandidate = (e) => e.candidate && sig(gid, peerId, 'ice', e.candidate)
    pc.ontrack = (e) => setTiles((t) => {
      const cur = t[peerId]?.stream || e.streams[0] || new MediaStream()
      if (!cur.getTracks().includes(e.track)) cur.addTrack(e.track)
      return { ...t, [peerId]: { stream: cur, name: meta?.name || 'সদস্য', avatar: meta?.avatar } }
    })
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') dropPeer(peerId) }
    setTiles((t) => ({ ...t, [peerId]: { ...(t[peerId] || {}), name: meta?.name || 'সদস্য', avatar: meta?.avatar } }))
    return entry
  }
  const dropPeer = (peerId) => {
    pcs.current[peerId]?.pc.close(); delete pcs.current[peerId]
    setTiles((t) => { const n = { ...t }; delete n[peerId]; return n })
  }
  // যে পরে ঢুকেছে সে আগের সবাইকে অফার পাঠায় (দুই পক্ষ একসাথে অফার করার ঝামেলা এড়াতে)
  const reconcile = async (list) => {
    const g = gcRef.current; if (!g) return
    const gid = g.group.id
    for (const m of list) {
      if (m.id === user.id || pcs.current[m.id]) continue
      const iOffer = m.at < myAt.current || (m.at === myAt.current && m.id < user.id)
      if (!iOffer) continue
      const { pc } = makePeer(gid, m.id, m)
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer)
      sig(gid, m.id, 'offer', offer)
    }
    for (const id of Object.keys(pcs.current)) if (!list.some((m) => m.id === id)) dropPeer(id)
  }
  const onSig = async (gid, { from, t, d }) => {
    const g = gcRef.current; if (!g || g.group.id !== gid) return
    const meta = presenceList(gid).find((m) => m.id === from)
    if (t === 'offer') {
      const e = makePeer(gid, from, meta)
      await e.pc.setRemoteDescription(d)
      for (const c of e.pending) await e.pc.addIceCandidate(c).catch(() => {})
      e.pending = []
      const ans = await e.pc.createAnswer(); await e.pc.setLocalDescription(ans)
      sig(gid, from, 'answer', ans)
    } else if (t === 'answer') {
      const e = pcs.current[from]; if (!e) return
      await e.pc.setRemoteDescription(d)
      for (const c of e.pending) await e.pc.addIceCandidate(c).catch(() => {})
      e.pending = []
    } else if (t === 'ice') {
      const e = pcs.current[from] || makePeer(gid, from, meta)
      if (e.pc.remoteDescription) e.pc.addIceCandidate(d).catch(() => {}); else e.pending.push(d)
    }
  }

  // ---------- কলে যোগ / বের হওয়া ----------
  const join = async (group, kind, { starting = false } = {}) => {
    if (gcRef.current) return alert('আপনি আগে থেকেই একটি কলে আছেন')
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return alert('এই ব্রাউজারে কল সমর্থিত নয়।')
    stopRing.current?.(); stopRing.current = null; setRing(null)
    const r = ensureRoom(group.id); r.refs++
    await r.ready
    if (presenceList(group.id).filter((m) => m.id !== user.id).length >= MAX_GROUP_CALL - 1) { r.refs--; closeRoomIfIdle(group.id); return alert(`একসাথে সর্বোচ্চ ${MAX_GROUP_CALL} জন কলে থাকতে পারে`) }
    try { await lm.acquire(kind) } catch (e) { r.refs--; closeRoomIfIdle(group.id); return alert(mediaMsg(e, kind)) }
    myAt.current = Date.now()
    const g = { group, kind }
    gcRef.current = g; setGc(g); setSecs(0)
    clock.current = setInterval(() => setSecs((s) => s + 1), 1000)
    await r.ch.track({ id: user.id, name: profile.full_name, avatar: profile.avatar_url, at: myAt.current })
    if (starting) {
      supabase.rpc('notify_group_call', { p_group: group.id, p_kind: kind })
      supabase.from('group_messages').insert({ group_id: group.id, sender_id: user.id, content: kind === 'video' ? '📹 গ্রুপ ভিডিও কল শুরু করেছেন — যোগ দিন' : '📞 গ্রুপ অডিও কল শুরু করেছেন — যোগ দিন' }).then(() => {})
    }
  }
  const leave = async () => {
    const g = gcRef.current; if (!g) return
    gcRef.current = null
    clearInterval(clock.current)
    const r = rooms.current[g.group.id]
    try { await r?.ch.untrack() } catch { /* ignore */ }
    Object.keys(pcs.current).forEach(dropPeer)
    lm.release()
    if (r) r.refs--
    setGc(null); setTiles({}); setMini(false); setShowFx(false); setShowReact(false)
    closeRoomIfIdle(g.group.id)
  }
  const startGroupCall = (group, kind) => join(group, kind, { starting: true })
  const joinGroupCall = (group, kind) => join(group, kind)

  // ---------- ইনকামিং আমন্ত্রণ ----------
  useEffect(() => {
    const ch = supabase.channel(`gring-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, async ({ new: n }) => {
        if (n.type !== 'group_call' || gcRef.current) return
        const m = /\/groups\/([^?]+)\?.*call=(audio|video)/.exec(n.link || ''); if (!m) return
        const [{ data: grp }, { data: actor }] = await Promise.all([
          supabase.from('groups').select('id,name,avatar_url').eq('id', m[1]).single(),
          supabase.from('profiles').select('full_name,avatar_url').eq('id', n.actor_id).single(),
        ])
        if (!grp) return
        setRing({ group: grp, kind: m[2], who: actor?.full_name || 'কেউ', avatar: actor?.avatar_url })
        stopRing.current?.(); stopRing.current = ringtone('in')
        setTimeout(() => { stopRing.current?.(); stopRing.current = null; setRing((r) => (r?.group.id === grp.id ? null : r)) }, 40000)
      }).subscribe()
    return () => { supabase.removeChannel(ch); leave() }
    // eslint-disable-next-line
  }, [user.id])

  const react = (e) => { addFloat(e); rooms.current[gcRef.current.group.id]?.ch.send({ type: 'broadcast', event: 'react', payload: { e } }) }

  const peers = Object.entries(tiles)
  const total = peers.length + 1
  const isVideo = gc?.kind === 'video'
  const cols = total <= 2 ? 'grid-cols-1' : 'grid-cols-2'
  const Ctl = ({ onClick, icon: I, active, danger, disabled }) => (
    <button onClick={onClick} disabled={disabled} className="disabled:opacity-40">
      <span className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-90 ${danger ? 'bg-[#e11d48] text-white' : active ? 'bg-white text-ink' : 'bg-white/15 text-white'}`}><I size={21} /></span>
    </button>
  )

  return (
    <Ctx.Provider value={{ startGroupCall, joinGroupCall, watch, live, inGroupCall: gc?.group.id || null }}>
      {children}

      {ring && !gc && (
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] mx-auto max-w-md rounded-[28px] bg-[#0b3d2e] p-4 text-white shadow-soft ring-1 ring-white/15">
          <div className="flex items-center gap-3">
            <Avatar p={{ full_name: ring.group.name, avatar_url: ring.group.avatar_url }} size={48} />
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{ring.group.name}</p><p className="truncate text-sm text-white/75">{ring.who} গ্রুপ {ring.kind === 'video' ? 'ভিডিও' : 'অডিও'} কল শুরু করেছেন</p></div>
          </div>
          <div className="mt-3 flex gap-3">
            <button onClick={() => { stopRing.current?.(); stopRing.current = null; setRing(null) }} className="flex-1 rounded-2xl bg-white/15 py-2.5 font-semibold">উপেক্ষা</button>
            <button onClick={() => joinGroupCall(ring.group, ring.kind)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-2.5 font-bold">{ring.kind === 'video' ? <Video size={18} /> : <Phone size={18} />}যোগ দিন</button>
          </div>
        </div>
      )}

      {gc && mini && (
        <button onClick={() => setMini(false)} className="fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#0b3d2e] py-1.5 pl-1.5 pr-4 text-white shadow-soft ring-1 ring-white/15">
          <Avatar p={{ full_name: gc.group.name, avatar_url: gc.group.avatar_url }} size={34} />
          <span className="text-left text-sm leading-tight"><b className="block max-w-[9rem] truncate">{gc.group.name}</b><span className="text-xs text-white/70">{mmss(secs)} • {total} জন</span></span>
          <span onClick={(e) => { e.stopPropagation(); leave() }} className="grid h-8 w-8 place-items-center rounded-full bg-[#e11d48]"><PhoneOff size={16} /></span>
        </button>
      )}
      {gc && (
        <div className={mini ? 'pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0' : 'fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#0b1f1a] to-[#07120f] text-white'}>
          <div className="relative z-10 flex items-start gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button onClick={() => setMini(true)} aria-label="ছোট করুন" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/35"><Minimize2 size={19} /></button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-xl font-bold">{gc.group.name}</p>
              <p className="flex items-center justify-center gap-1.5 text-sm text-white/70"><Lock size={13} />এন্ড-টু-এন্ড এনক্রিপ্টেড</p>
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-white/80"><Users size={14} />{total} জন • {mmss(secs)}</p>
            </div>
            <span className="w-11" />
          </div>
          <div className={`relative z-10 grid min-h-0 flex-1 auto-rows-fr gap-2 p-3 ${cols}`}>
            <Tile stream={lm.stream.current} name={profile.full_name} avatar={profile.avatar_url} local mirror={lm.facing === 'user'} big={total === 3 || total === 5} />
            {peers.map(([id, t]) => <Tile key={id} stream={t.stream} name={t.name} avatar={t.avatar} />)}
            {peers.length === 0 && <div className="grid place-items-center rounded-3xl bg-white/5 text-center text-white/70"><div><Users className="mx-auto mb-2" />অন্যদের যোগ দেওয়ার অপেক্ষা…</div></div>}
          </div>
          <Floaters items={floats} />
          {showFx && isVideo && <EffectsTray value={lm.effect} onPick={(id) => lm.setEffect(id)} onClose={() => setShowFx(false)} />}
          {showReact && <ReactBar onReact={react} />}
          <div className="relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-around rounded-full bg-black/45 px-2 py-2.5 backdrop-blur">
            {isVideo && <Ctl onClick={lm.flip} icon={SwitchCamera} disabled={!lm.hasVideo} />}
            {isVideo && <Ctl onClick={lm.toggleCam} icon={lm.camOff ? VideoOff : Video} active={lm.camOff} disabled={!lm.hasVideo} />}
            {isVideo && lm.canFx && <Ctl onClick={() => { setShowFx((v) => !v); setShowReact(false) }} icon={Sparkles} active={showFx} disabled={!lm.hasVideo} />}
            <Ctl onClick={() => { setShowReact((v) => !v); setShowFx(false) }} icon={Smile} active={showReact} />
            <Ctl onClick={lm.toggleMic} icon={lm.muted ? MicOff : Mic} active={lm.muted} />
            <Ctl onClick={leave} icon={PhoneOff} danger />
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
