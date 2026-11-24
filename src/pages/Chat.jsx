import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useCall } from '../context/Call'
import { useInbox } from '../context/Inbox'
import { usePresence } from '../context/Presence'
import { safeName, compressImage } from '../lib/media'
import { playSend } from '../lib/sound'
import { toast, errMsg } from '../lib/ui'
import ChatHeader from '../components/chat/ChatHeader'
import MessageList from '../components/chat/MessageList'
import Composer from '../components/chat/Composer'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'
import AttachMenu from '../components/chat/AttachMenu'
import CameraSheet from '../components/CameraSheet'
import UserCard from '../components/UserCard'
import PollSheet from '../components/chat/PollSheet'
import ContactSheet from '../components/chat/ContactSheet'
import MessageMenu from '../components/chat/MessageMenu'
import PinnedBanner from '../components/chat/PinnedBanner'
import ChatSearchBar from '../components/chat/ChatSearchBar'
import ChatToolsSheet, { ttlLabel } from '../components/chat/ChatToolsSheet'
import { useLongPress } from '../lib/useLongPress'

const MAX = 50 * 1024 * 1024
const PAGE = 60 // একবারে এতগুলো মেসেজ আনা হয়; পুরনো মেসেজ "আগের মেসেজ" বাটনে
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
  const [ttl, setTtl] = useState(0)            // অদৃশ্য হওয়া মেসেজের সময় (সেকেন্ড, ০ = বন্ধ)
  const [searching, setSearching] = useState(false)
  const [menuMsg, setMenuMsg] = useState(null)
  const [hl, setHl] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const hlT = useRef()
  const end = useRef(), msgsRef = useRef([]), scroller = useRef()
  const [hasOlder, setHasOlder] = useState(false), [loadingOlder, setLoadingOlder] = useState(false)
  const olderRef = useRef(false), prepend = useRef(null)
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
    const { data } = await supabase.from('poll_votes').select('message_id,user_id,option_idx').in('message_id', ids)
    const g = Object.fromEntries(ids.map((i) => [i, []]))
    ;(data || []).forEach((v) => g[v.message_id].push(v))
    setVotes((p) => ({ ...p, ...g }))
  }, [])

  useEffect(() => {
    setMsgs([]); setHasOlder(false); olderRef.current = false
    const markRead = () => supabase.rpc('mark_chat_read', { p_other: id }).then(({ error }) => { if (!error) reloadInbox() })
    markRead()
    supabase.from('profiles').select('*').eq('id', id).single().then(({ data }) => setOther(data))
    supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false }).limit(PAGE)
      .then(({ data, error }) => {
        if (error) return toast.error('মেসেজ লোড হয়নি: ' + errMsg(error))
        const l = (data || []).reverse(); setMsgs(l); sign(l); loadVotes(l)
        olderRef.current = (data || []).length === PAGE; setHasOlder(olderRef.current)
      })
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

  // ── অদৃশ্য হওয়া মেসেজ: সেটিং আনা, মেয়াদ শেষ মেসেজ সাফ ও লুকানো ──
  const loadTtl = useCallback(async () => {
    const [a, b] = user.id < id ? [user.id, id] : [id, user.id]
    const { data } = await supabase.from('chat_ttl').select('ttl_secs').eq('user_a', a).eq('user_b', b).maybeSingle()
    setTtl(data?.ttl_secs || 0)
  }, [user.id, id])
  useEffect(() => {
    loadTtl()
    supabase.rpc('purge_expired_messages').then(() => {}, () => {}) // ফাংশন না থাকলে কিছু হয় না
    window.addEventListener('focus', loadTtl)
    return () => window.removeEventListener('focus', loadTtl)
  }, [loadTtl])
  useEffect(() => {
    if (!msgs.some((m) => m.expires_at)) return
    const t = setInterval(() => setNow(Date.now()), 20000)
    return () => clearInterval(t)
  }, [msgs])
  const shown = useMemo(() => msgs.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now), [msgs, now])
  const pinned = useMemo(() => shown.filter((m) => m.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at)), [shown])

  // পুরনো মেসেজ ওপরে যোগ হলে স্ক্রল-জায়গা ধরে রাখা; নতুন মেসেজে নিচে নামা
  useLayoutEffect(() => {
    const el = scroller.current, p = prepend.current
    if (p && el) { el.scrollTop = el.scrollHeight - p; prepend.current = null; return }
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])
  const loadOlder = useCallback(async () => {
    const first = msgsRef.current.find((m) => !m._st)
    if (!first || !olderRef.current) return 0
    setLoadingOlder(true)
    const { data, error } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
      .lt('created_at', first.created_at).order('created_at', { ascending: false }).limit(PAGE)
    setLoadingOlder(false)
    if (error) { toast.error('পুরনো মেসেজ আনা যায়নি: ' + errMsg(error)); return 0 }
    const l = (data || []).reverse()
    olderRef.current = l.length === PAGE; setHasOlder(olderRef.current)
    if (!l.length) return 0
    prepend.current = scroller.current?.scrollHeight ?? null
    setMsgs((m) => { const have = new Set(m.map((x) => x.id)); return [...l.filter((x) => !have.has(x.id)), ...m] })
    sign(l); loadVotes(l)
    return l.length
  }, [id, user.id, sign, loadVotes])

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

  // ---------- মেসেজ চেপে ধরলে মেনু: কপি / পিন; খোঁজা থেকে লাফ ----------
  const jump = async (mid) => {
    // মেসেজটি এখনো লোড না হয়ে থাকলে (পুরনো) পাওয়া পর্যন্ত পেছনের পাতা আনা
    for (let i = 0; i < 30 && !document.getElementById('m-' + mid) && olderRef.current; i++) {
      if (!(await loadOlder())) break
      await new Promise((r) => setTimeout(r, 0))
    }
    document.getElementById('m-' + mid)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHl(mid); clearTimeout(hlT.current); hlT.current = setTimeout(() => setHl(null), 1600)
  }
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast.success('কপি হয়েছে') } catch { toast.error('কপি করা যায়নি') } }
  const pinMsg = async (m) => {
    const pin = !m.pinned_at
    const { error } = await supabase.rpc('pin_message', { p_msg: m.id, p_pin: pin })
    if (error) return toast.error(/pin_limit/.test(error.message) ? 'সর্বোচ্চ ৩টি মেসেজ পিন করা যায়' : /could not find the function|schema cache/i.test(error.message) ? 'চালু হয়নি — update-22.sql চালানো হয়নি' : errMsg(error))
    setMsgs((l) => l.map((x) => (x.id === m.id ? { ...x, pinned_at: pin ? new Date().toISOString() : null } : x)))
    toast.success(pin ? 'মেসেজ পিন করা হয়েছে' : 'পিন সরানো হয়েছে')
  }
  const lp = useLongPress((m) => { if (!String(m.id).startsWith('tmp-') && m.type !== 'call') setMenuMsg(m) })

  // ---------- ভয়েস রেকর্ডিং (লজিক: lib/useVoiceRecorder) ----------
  const { rec, start: startRec, stop: stopRec } = useVoiceRecorder({
    onError: setErr,
    onFinish: (file, meta) => sendFile(file, 'voice', meta),
  })
  useEffect(() => { if (rec) setErr('') }, [rec])

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-forest sm:max-w-xl lg:left-64 lg:max-w-3xl">
      <ChatHeader other={other} online={isOnline(id)} typing={typing} inCall={inCall} onBack={() => nav(-1)} onCard={() => setCard(true)}
        onCall={(kind) => startCall(other, kind)} onTools={() => setSheet('tools')} />

      {searching && <ChatSearchBar msgs={shown} onJump={jump} onClose={() => setSearching(false)} />}
      {ttl > 0 && <p className="bg-surface2 px-4 py-1.5 text-center text-xs font-semibold text-fg/70">⏱ এই চ্যাটে নতুন মেসেজ {ttlLabel(ttl)} পর মুছে যায়</p>}
      <PinnedBanner pinned={pinned} onJump={jump} />

      <MessageList scrollerRef={scroller} endRef={end} shown={shown} myId={user.id} urls={urls} votes={votes} hl={hl} lp={lp}
        hasOlder={hasOlder} loadingOlder={loadingOlder} onLoadOlder={loadOlder} onVote={vote} onOpenImage={setViewer}
        onRetry={(m) => sendOptimistic(m.content, m.id)} onDiscard={(m) => setMsgs((l) => l.filter((x) => x.id !== m.id))} />

      {busy && <p className="px-4 pb-1 text-sm text-brand">আপলোড হচ্ছে…</p>}
      {err && <p className="px-4 pb-1 text-sm text-danger">{err}</p>}

      <Composer rec={rec} text={text} onText={(v) => { setText(v); sendTyping() }} onSubmit={sendText}
        onAttach={() => setSheet('menu')} onStartRec={startRec} onStopRec={stopRec} />

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
      {menuMsg && <MessageMenu m={menuMsg} onClose={() => setMenuMsg(null)} onCopy={copyText} onPin={pinMsg} />}
      {sheet === 'tools' && <ChatToolsSheet otherId={id} ttl={ttl} onTtl={setTtl} onSearch={() => setSearching(true)} onClose={() => setSheet(null)} />}
      {viewer && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90" onClick={() => setViewer(null)}><img src={viewer} alt="বড় করে দেখা ছবি" className="max-h-full max-w-full" /></div>}
    </div>
  )
}
