import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Plus, Mic, Phone, Video, Trash2 } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useCall } from '../context/Call'
import { useInbox } from '../context/Inbox'
import { usePresence } from '../context/Presence'
import { safeName, mmss, compressImage } from '../lib/media'
import { playSend } from '../lib/sound'
import { toast, errMsg } from '../lib/ui'
import Avatar from '../components/Avatar'
import Bubble from '../components/chat/Bubble'
import AttachMenu from '../components/chat/AttachMenu'
import CameraSheet from '../components/CameraSheet'
import UserCard from '../components/UserCard'
import PollSheet from '../components/chat/PollSheet'
import ContactSheet from '../components/chat/ContactSheet'

const MAX = 50 * 1024 * 1024
const LABEL = { image: '📷 ছবি', video: '🎬 ভিডিও', audio: '🎵 অডিও', voice: '🎤 ভয়েস মেসেজ' }

export default function Chat() {
  const { id } = useParams()
  const { user } = useAuth()
  const { startCall, inCall } = useCall()
  const { reload: reloadInbox } = useInbox()
  const { isOnline } = usePresence()
  const [typing, setTyping] = useState(false)
  const typeCh = useRef(), typingT = useRef(), lastTyping = useRef(0)
  const nav = useNavigate()
  const [other, setOther] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [urls, setUrls] = useState({})
  const [votes, setVotes] = useState({})
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(null) // menu | poll | contact
  const [card, setCard] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [rec, setRec] = useState(null)
  const end = useRef(), msgsRef = useRef([])
  const mr = useRef(), chunks = useRef([]), recTimer = useRef(), recStart = useRef()
  const refs = { image: useRef(), video: useRef(), audio: useRef(), file: useRef() }
  msgsRef.current = msgs

  const addMsg = useCallback((n) => setMsgs((m) => (m.some((x) => x.id === n.id) ? m.map((x) => (x.id === n.id ? n : x)) : [...m, n])), [])
  const sign = useCallback(async (list) => {
    const paths = list.filter((m) => m.media_path).map((m) => m.media_path)
    if (!paths.length) return
    const { data } = await supabase.storage.from('chat').createSignedUrls(paths, 21600)
    if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) }))
  }, [])
  const loadVotes = useCallback(async (list) => {
    const ids = list.filter((m) => m.type === 'poll').map((m) => m.id)
    if (!ids.length) return
    const { data } = await supabase.from('poll_votes').select('*').in('message_id', ids)
    const g = Object.fromEntries(ids.map((i) => [i, []]))
    ;(data || []).forEach((v) => g[v.message_id].push(v))
    setVotes((p) => ({ ...p, ...g }))
  }, [])

  useEffect(() => {
    setMsgs([])
    const markRead = () => supabase.rpc('mark_chat_read', { p_other: id }).then(({ error }) => { if (!error) reloadInbox() })
    markRead()
    supabase.from('profiles').select('*').eq('id', id).single().then(({ data }) => setOther(data))
    supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
      .order('created_at').then(({ data }) => { const l = data || []; setMsgs(l); sign(l); loadVotes(l) })
    const onChange = (p) => {
      const n = p.new
      if (!n?.id) return
      if (!((n.sender_id === id && n.receiver_id === user.id) || (n.sender_id === user.id && n.receiver_id === id))) return
      addMsg(n); sign([n]); loadVotes([n])
      if (n.sender_id === id && !n.read_at) markRead()
    }
    const ch = supabase.channel(`chat-${user.id}-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => loadVotes(msgsRef.current))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, user.id, addMsg, sign, loadVotes, reloadInbox])

  // "লিখছে…" ইন্ডিকেটর (Realtime broadcast, কোনো SQL লাগে না)
  useEffect(() => {
    const ch = supabase.channel(`typing-${[user.id, id].sort().join('-')}`)
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.from !== id) return
      setTyping(true); clearTimeout(typingT.current); typingT.current = setTimeout(() => setTyping(false), 3000)
    }).subscribe()
    typeCh.current = ch
    return () => { clearTimeout(typingT.current); supabase.removeChannel(ch); typeCh.current = null; setTyping(false) }
  }, [id, user.id])
  const sendTyping = () => {
    const n = Date.now()
    if (n - lastTyping.current < 2000 || !typeCh.current) return
    lastTyping.current = n
    typeCh.current.send({ type: 'broadcast', event: 'typing', payload: { from: user.id } })
  }

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const sendMsg = async (fields) => {
    const { data, error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: id, ...fields }).select().single()
    if (error) { setErr('মেসেজ পাঠানো যায়নি — শুধু বন্ধুদের মেসেজ পাঠানো যায়।'); return null }
    addMsg(data); sign([data]); loadVotes([data]); playSend()
    return data
  }
  // টেক্সট মেসেজ: সঙ্গে সঙ্গে "পাঠানো হচ্ছে" অবস্থায় দেখায়; ব্যর্থ হলে লেখা হারায় না, "আবার পাঠান" থাকে
  const sendOptimistic = async (t, tmpId) => {
    const tid = tmpId || `tmp-${crypto.randomUUID()}`
    if (tmpId) setMsgs((l) => l.map((x) => (x.id === tid ? { ...x, _st: 'sending' } : x)))
    else setMsgs((l) => [...l, { id: tid, sender_id: user.id, receiver_id: id, type: 'text', content: t, created_at: new Date().toISOString(), _st: 'sending' }])
    const { data, error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: id, content: t }).select().single()
    if (error) {
      setMsgs((l) => l.map((x) => (x.id === tid ? { ...x, _st: 'failed' } : x)))
      toast.error(/policy|row-level|blocked/i.test(error.message || '') ? 'মেসেজ পাঠানো যায়নি — শুধু বন্ধুদের মেসেজ পাঠানো যায়।' : errMsg(error, 'মেসেজ পাঠানো যায়নি'))
      return
    }
    // রিয়েলটাইম আগে এসে গেলে ডুপ্লিকেট এড়াতে সাময়িক মেসেজটি সরিয়ে দিই
    setMsgs((l) => (l.some((x) => x.id === data.id) ? l.filter((x) => x.id !== tid) : l.map((x) => (x.id === tid ? data : x))))
    sign([data]); loadVotes([data]); playSend()
  }
  const sendText = async (e) => {
    e.preventDefault()
    const t = text.trim(); if (!t) return
    setText(''); setErr('')
    await sendOptimistic(t)
  }
  const sendFile = async (file, type, meta = null) => {
    setErr('')
    if (type === 'image') file = await compressImage(file) // ছবি ছোট করে পাঠানো (ধীর নেটে দ্রুত)
    if (file.size > MAX) return setErr('ফাইল ৫০MB-এর বেশি হতে পারবে না')
    setBusy(true)
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${safeName(file.name)}`
      const { error } = await supabase.storage.from('chat').upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (error) throw error
      await sendMsg({
        type, media_path: path, file_name: file.name, file_size: file.size, mime: file.type, meta,
        content: type === 'file' ? `📎 ${file.name}` : LABEL[type],
      })
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const onFiles = (type) => async (e) => {
    const fs = [...e.target.files]; e.target.value = ''
    for (const f of fs) await sendFile(f, type)
  }
  const pick = (k) => {
    if (k === 'contact' || k === 'poll' || k === 'camera') return setSheet(k)
    setSheet(null); refs[k].current.click()
  }

  const vote = async (m, i) => {
    const mine = (votes[m.id] || []).find((v) => v.user_id === user.id)
    if (mine?.option_idx === i) await supabase.from('poll_votes').delete().match({ message_id: m.id, user_id: user.id })
    else await supabase.from('poll_votes').upsert({ message_id: m.id, user_id: user.id, option_idx: i }, { onConflict: 'message_id,user_id' })
    loadVotes([m])
  }

  // ---------- ভয়েস রেকর্ডিং ----------
  const startRec = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => window.MediaRecorder?.isTypeSupported(t)) || ''
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.start(); mr.current = r; recStart.current = Date.now(); setRec({ secs: 0 })
      recTimer.current = setInterval(() => setRec({ secs: Math.round((Date.now() - recStart.current) / 1000) }), 500)
    } catch { setErr('মাইক্রোফোন ব্যবহারের অনুমতি দিন') }
  }
  const stopRec = (shouldSend) => {
    const r = mr.current; if (!r) return
    clearInterval(recTimer.current)
    const duration = Math.round((Date.now() - recStart.current) / 1000)
    r.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop())
      if (shouldSend && duration >= 1) {
        const base = (r.mimeType || 'audio/webm').split(';')[0]
        const ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm'
        sendFile(new File([new Blob(chunks.current, { type: base })], `voice-${Date.now()}.${ext}`, { type: base }), 'voice', { duration })
      }
    }
    r.stop(); mr.current = null; setRec(null)
  }
  useEffect(() => () => { clearInterval(recTimer.current); mr.current?.stream.getTracks().forEach((t) => t.stop()) }, [])

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-forest sm:max-w-xl lg:left-64 lg:max-w-3xl">
      <header className="flex items-center gap-3 bg-surface p-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm">
        <button onClick={() => nav(-1)} aria-label="পেছনে যান" className="grid h-10 w-10 place-items-center rounded-full bg-surface2"><ArrowLeft size={20} /></button>
        <button onClick={() => setCard(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar p={other} size={40} online={isOnline(id)} />
          <div className="min-w-0 flex-1 leading-tight"><b className="block truncate">{other?.full_name}</b><span className="text-xs text-brand">{typing ? 'লিখছে…' : isOnline(id) ? 'অনলাইন' : ''}</span></div>
        </button>
        <button disabled={inCall || !other} onClick={() => startCall(other, 'audio')} aria-label="অডিও কল" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-brand disabled:opacity-40"><Phone size={19} /></button>
        <button disabled={inCall || !other} onClick={() => startCall(other, 'video')} aria-label="ভিডিও কল" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-brand disabled:opacity-40"><Video size={19} /></button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m) => (
          <div key={m.id}>
            <Bubble m={m} mine={m.sender_id === user.id} myId={user.id} url={urls[m.media_path]}
              votes={votes[m.id]} onVote={vote} onOpenImage={setViewer} />
            {m._st === 'failed' && (
              <div className="mt-1 flex items-center justify-end gap-3 pr-1 text-xs font-semibold">
                <span className="text-danger">পাঠানো যায়নি</span>
                <button onClick={() => sendOptimistic(m.content, m.id)} className="text-brand">আবার পাঠান</button>
                <button onClick={() => setMsgs((l) => l.filter((x) => x.id !== m.id))} className="text-fg/60">মুছুন</button>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      {busy && <p className="px-4 pb-1 text-sm text-brand">আপলোড হচ্ছে…</p>}
      {err && <p className="px-4 pb-1 text-sm text-danger">{err}</p>}

      {rec ? (
        <div className="flex items-center gap-3 bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => stopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-danger"><Trash2 size={20} /></button>
          <span className="h-3 w-3 animate-pulse rounded-full bg-danger/150" />
          <span className="flex-1 font-semibold tabular-nums">রেকর্ড হচ্ছে… {mmss(rec.secs)}</span>
          <button onClick={() => stopRec(true)} className="btn-primary !px-4"><Send size={20} /></button>
        </div>
      ) : (
        <form onSubmit={sendText} className="flex items-center gap-2 bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setSheet('menu')} aria-label="যুক্ত করুন" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 text-brand"><Plus size={22} /></button>
          <input className="input" placeholder="মেসেজ লিখুন…" value={text} onChange={(e) => { setText(e.target.value); sendTyping() }} />
          {text.trim()
            ? <button aria-label="পাঠান" className="btn-primary !px-4"><Send size={20} /></button>
            : <button type="button" onClick={startRec} aria-label="ভয়েস মেসেজ রেকর্ড করুন" className="btn-primary !px-4"><Mic size={20} /></button>}
        </form>
      )}

      <input ref={refs.image} type="file" accept="image/*" multiple hidden onChange={onFiles('image')} />
      <input ref={refs.video} type="file" accept="video/*" hidden onChange={onFiles('video')} />
      <input ref={refs.audio} type="file" accept="audio/*" hidden onChange={onFiles('audio')} />
      <input ref={refs.file} type="file" hidden onChange={onFiles('file')}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" />

      {card && <UserCard userId={id} onClose={() => setCard(false)} />}
      {sheet === 'camera' && <CameraSheet onClose={() => setSheet(null)} onCapture={(f) => sendFile(f, f.type.startsWith('video/') ? 'video' : 'image')} />}
      {sheet === 'menu' && <AttachMenu onPick={pick} onClose={() => setSheet(null)} />}
      {sheet === 'poll' && <PollSheet onClose={() => setSheet(null)} onCreate={async (meta) => { setSheet(null); await sendMsg({ type: 'poll', content: `📊 ${meta.question}`, meta }) }} />}
      {sheet === 'contact' && <ContactSheet onClose={() => setSheet(null)} onSend={async (meta) => { setSheet(null); await sendMsg({ type: 'contact', content: `👤 ${meta.name}`, meta }) }} />}
      {viewer && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90" onClick={() => setViewer(null)}><img src={viewer} alt="" className="max-h-full max-w-full" /></div>}
    </div>
  )
}
