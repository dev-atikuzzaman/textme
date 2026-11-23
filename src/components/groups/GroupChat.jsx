import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Plus, FileText, Download, Clock, AlertCircle, Pin, Search } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { extOf, safeName, fmtSize, compressImage } from '../../lib/media'
import { uploadToStorage, friendlyUploadError, MAX_UPLOAD } from '../../lib/upload'
import AttachMenu from '../chat/AttachMenu'
import { findYt } from '../../lib/yt'
import YouTubeEmbed from '../YouTubeEmbed'
import { playSend } from '../../lib/sound'
import { linkify } from '../../lib/linkify'
import Lightbox from '../post/Lightbox'
import CameraSheet from '../CameraSheet'
import SmartImg from '../SmartImg'
import MessageMenu from '../chat/MessageMenu'
import PinnedBanner from '../chat/PinnedBanner'
import ChatSearchBar from '../chat/ChatSearchBar'
import { useLongPress } from '../../lib/useLongPress'
import { toast, errMsg } from '../../lib/ui'

const NAME_COLORS = ['text-emerald-600', 'text-sky-600', 'text-amber-600', 'text-pink-600', 'text-violet-600', 'text-orange-600', 'text-teal-600', 'text-lime-600']
const nameColor = (id = '') => NAME_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length]
const time = (d) => new Date(d).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })

// WhatsApp-স্টাইল গ্রুপ চ্যাট (রিয়েলটাইম)
export default function GroupChat({ groupId, who, onUser }) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(null)
  const [cam, setCam] = useState(false)
  const [menu, setMenu] = useState(false)
  const [pct, setPct] = useState(0)
  const [searching, setSearching] = useState(false)
  const [msgMenu, setMsgMenu] = useState(null)
  const [hl, setHl] = useState(null)
  const hlT = useRef()
  const end = useRef()
  const refs = { image: useRef(), video: useRef(), audio: useRef(), file: useRef() }

  // সার্ভারের last_read_at-এর পাশাপাশি এই ডিভাইসেও "কতটুকু পড়া" রাখা হয়, যাতে মেসেজ তালিকার আনরিড সংখ্যা সঙ্গে সঙ্গে ঠিক হয়
  const markRead = useCallback((upto) => {
    try { localStorage.setItem('gread:' + groupId, upto || new Date().toISOString()) } catch { /* ignore */ }
    supabase.rpc('mark_group_read', { p_group: groupId })
  }, [groupId])
  const add = useCallback((m) => setMsgs((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l)), [])

  useEffect(() => {
    setMsgs(null)
    supabase.from('group_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { setMsgs((data || []).reverse()); if (error) setErr(error.message); markRead(data?.[0]?.created_at) })
    const ch = supabase.channel(`gchat-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (p) => { setMsgs((l) => (l && !l.some((x) => x.id === p.new.id) ? [...l, p.new] : l)); if (p.new.sender_id !== user.id) markRead(p.new.created_at) })
      // পিন/আনপিন হলে অন্য সদস্যদের স্ক্রিনেও বদলায়
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (p) => setMsgs((l) => (l ? l.map((x) => (x.id === p.new.id ? { ...x, ...p.new } : x)) : l)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [groupId, user.id, markRead])

  const pinned = useMemo(() => (msgs || []).filter((m) => m.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at)), [msgs])
  const jump = (mid) => {
    document.getElementById('m-' + mid)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHl(mid); clearTimeout(hlT.current); hlT.current = setTimeout(() => setHl(null), 1600)
  }
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast.success('কপি হয়েছে') } catch { toast.error('কপি করা যায়নি') } }
  const pinMsg = async (m) => {
    const pin = !m.pinned_at
    const { error } = await supabase.rpc('pin_group_message', { p_msg: m.id, p_pin: pin })
    if (error) return toast.error(/pin_limit/.test(error.message) ? 'সর্বোচ্চ ৩টি মেসেজ পিন করা যায়' : /could not find the function|schema cache/i.test(error.message) ? 'চালু হয়নি — update-22.sql চালানো হয়নি' : errMsg(error))
    setMsgs((l) => (l || []).map((x) => (x.id === m.id ? { ...x, pinned_at: pin ? new Date().toISOString() : null } : x)))
    toast.success(pin ? 'মেসেজ পিন করা হয়েছে' : 'পিন সরানো হয়েছে')
  }
  const lp = useLongPress((m) => { if (!String(m.id).startsWith('tmp-')) setMsgMenu(m) })

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs?.length])

  const send = async (fields) => {
    setErr('')
    const { data, error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: user.id, ...fields }).select().single()
    if (error) return setErr('মেসেজ পাঠানো যায়নি')
    add(data); playSend()
  }
  // টেক্সট মেসেজ: সঙ্গে সঙ্গে "পাঠানো হচ্ছে" দেখায়; ব্যর্থ হলে লেখা হারায় না, "আবার পাঠান" থাকে
  const sendOptimistic = async (t, tmpId) => {
    const tid = tmpId || `tmp-${crypto.randomUUID()}`
    if (tmpId) setMsgs((l) => l.map((x) => (x.id === tid ? { ...x, _st: 'sending' } : x)))
    else setMsgs((l) => [...(l || []), { id: tid, group_id: groupId, sender_id: user.id, content: t, created_at: new Date().toISOString(), _st: 'sending' }])
    const { data, error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: user.id, content: t }).select().single()
    if (error) {
      setMsgs((l) => (l || []).map((x) => (x.id === tid ? { ...x, _st: 'failed' } : x)))
      toast.error(errMsg(error, 'মেসেজ পাঠানো যায়নি'))
      return
    }
    setMsgs((l) => (l || []).some((x) => x.id === data.id) ? l.filter((x) => x.id !== tid) : l.map((x) => (x.id === tid ? data : x)))
    playSend()
  }
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim(); if (!t) return
    setText(''); await sendOptimistic(t)
  }
  const sendFile = async (f0, kind) => {
    if (!f0) return
    const f = kind === 'file' ? f0 : await compressImage(f0) // ছবি ছোট হয়ে যায়, "ফাইল" হিসেবে পাঠালে আসলটাই
    if (f.size > MAX_UPLOAD) return setErr(`ফাইলটি ${fmtSize(f.size)} — সর্বোচ্চ ৫০MB`)
    const type = kind || (f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file')
    setBusy(true); setPct(0); setErr('')
    try {
      const path = `${user.id}/g-${Date.now()}-${crypto.randomUUID().slice(0, 6)}-${safeName(f.name || 'file.' + extOf(f))}`
      await uploadToStorage('media', path, f, setPct)
      await send({ media_url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl, media_type: type, file_name: f.name || null, file_size: f.size })
    } catch (er) { setErr(friendlyUploadError(er)) } finally { setBusy(false) }
  }
  const sendImage = (f) => sendFile(f, 'image')
  const onFile = (kind) => (e) => { const f = e.target.files[0]; e.target.value = ''; sendFile(f, kind === 'file' ? 'file' : undefined) }
  const pick = (k) => { setMenu(false); if (k === 'camera') setCam(true); else refs[k]?.current.click() }

  let lastDay = ''
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface2/60">
      {searching
        ? <ChatSearchBar msgs={msgs || []} onJump={jump} onClose={() => setSearching(false)} />
        : (
          <div className="flex items-center bg-surface">
            <div className="min-w-0 flex-1">{pinned.length ? <PinnedBanner pinned={pinned} onJump={jump} /> : <p className="px-4 py-2 text-xs text-fg/45">গ্রুপ চ্যাট • মেসেজ চেপে ধরে পিন বা কপি করুন</p>}</div>
            <button onClick={() => setSearching(true)} aria-label="গ্রুপ চ্যাটে খুঁজুন" className="mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface2"><Search size={16} /></button>
          </div>
        )}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {msgs === null && <p className="py-8 text-center text-fg/50">লোড হচ্ছে…</p>}
        {msgs?.length === 0 && <p className="py-8 text-center text-fg/50">এখনও কোনো মেসেজ নেই। প্রথম মেসেজটি আপনিই পাঠান 👋</p>}
        {msgs?.map((m, i) => {
          const mine = m.sender_id === user.id
          const day = new Date(m.created_at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' })
          const sep = day !== lastDay; lastDay = day
          const showName = !mine && msgs[i - 1]?.sender_id !== m.sender_id
          return (
            <div key={m.id} id={`m-${m.id}`} className={hl === m.id ? 'rounded-2xl ring-2 ring-coral/60' : ''}>
              {sep && <p className="my-2 text-center text-xs text-fg/40">{day}</p>}
              <div className={`flex ${mine ? 'justify-end' : ''}`}>
                <div {...lp(m)} className={`select-none max-w-[80%] rounded-2xl px-3 py-1.5 ${mine ? 'rounded-tr-sm bg-bubble text-white' : 'rounded-tl-sm bg-surface2'}`}>
                  {showName && <button type="button" onClick={() => onUser?.(m.sender_id)} className={`mb-0.5 block text-xs font-bold hover:underline ${nameColor(m.sender_id)}`}>{who[m.sender_id]?.full_name || 'সদস্য'}</button>}
                  {m.media_url && (!m.media_type || m.media_type === 'image') && <SmartImg src={m.media_url} alt="" reserve="min-h-[10rem] min-w-[12rem]" onClick={() => setZoom(m.media_url)} className="mb-1 max-h-64 cursor-zoom-in rounded-2xl object-cover" />}
                  {m.media_url && m.media_type === 'video' && <video src={m.media_url} controls playsInline preload="metadata" className="mb-1 max-h-64 rounded-2xl" />}
                  {m.media_url && m.media_type === 'audio' && <div className="mb-1"><p className="max-w-[14rem] truncate text-sm font-semibold">🎵 {m.file_name || 'অডিও'}</p><audio src={m.media_url} controls preload="none" className="h-10 w-56" /></div>}
                  {m.media_url && m.media_type === 'file' && (
                    <a href={m.media_url} target="_blank" rel="noreferrer" download={m.file_name || true} className={`mb-1 flex items-center gap-3 rounded-2xl p-3 ${mine ? 'bg-white/15' : 'bg-surface'}`}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><FileText size={20} /></span>
                      <span className="min-w-0 flex-1"><span className="block max-w-[11rem] truncate font-semibold">{m.file_name || 'ফাইল'}</span><span className="text-xs opacity-70">{m.file_size ? fmtSize(m.file_size) : 'ডাউনলোড'}</span></span>
                      <Download size={18} className="shrink-0 opacity-70" />
                    </a>
                  )}
                  {m.content && <p className="whitespace-pre-wrap break-words">{linkify(m.content)}</p>}
                  {m.content && findYt(m.content) && <YouTubeEmbed id={findYt(m.content)} className="mt-1.5 w-64 max-w-full" />}
                  <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/60' : 'text-fg/45'}`}>{m.pinned_at && <Pin size={11} aria-label="পিন করা" />}{time(m.created_at)}{m._st === 'sending' && <Clock size={11} aria-label="পাঠানো হচ্ছে" />}{m._st === 'failed' && <AlertCircle size={12} aria-label="পাঠানো যায়নি" className="text-red-300" />}</p>
                </div>
              </div>
              {m._st === 'failed' && (
                <div className="mt-1 flex items-center justify-end gap-3 pr-1 text-xs font-semibold">
                  <span className="text-danger">পাঠানো যায়নি</span>
                  <button onClick={() => sendOptimistic(m.content, m.id)} className="text-brand">আবার পাঠান</button>
                  <button onClick={() => setMsgs((l) => (l || []).filter((x) => x.id !== m.id))} className="text-fg/60">মুছুন</button>
                </div>
              )}
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {busy && <p className="bg-surface px-4 pt-2 text-sm text-brand">আপলোড হচ্ছে… {pct}%</p>}
      {err && <p className="bg-surface px-4 pt-2 text-sm text-danger">{err}</p>}
      <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-fg/5 bg-surface px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1.5">
        <input ref={refs.image} type="file" accept="image/*" hidden onChange={onFile('image')} />
        <input ref={refs.video} type="file" accept="video/*" hidden onChange={onFile('video')} />
        <input ref={refs.audio} type="file" accept="audio/*" hidden onChange={onFile('audio')} />
        <input ref={refs.file} type="file" hidden onChange={onFile('file')} />
        <button type="button" disabled={busy} onClick={() => setMenu(true)} aria-label="যুক্ত করুন" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand disabled:opacity-50"><Plus size={22} /></button>
        <input className="input !rounded-full !py-2" placeholder="মেসেজ লিখুন…" value={text} onChange={(e) => setText(e.target.value)} />
        <button aria-label="পাঠান" className="btn-primary !h-10 !rounded-full !p-0 aspect-square"><Send size={19} /></button>
      </form>
      {menu && <AttachMenu only={['camera', 'image', 'video', 'audio', 'file']} note="ডকুমেন্ট: যেকোনো ধরনের ফাইল • সর্বোচ্চ ৫০MB" onPick={pick} onClose={() => setMenu(false)} />}
      {cam && <CameraSheet mode="photo" onClose={() => setCam(false)} onCapture={sendImage} />}
      {msgMenu && <MessageMenu m={msgMenu} onClose={() => setMsgMenu(null)} onCopy={copyText} onPin={pinMsg} />}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}
