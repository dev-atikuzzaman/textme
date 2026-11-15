import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, ImagePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { extOf } from '../../lib/media'
import { playSend } from '../../lib/sound'
import { linkify } from '../../lib/linkify'
import Lightbox from '../post/Lightbox'

const NAME_COLORS = ['text-emerald-300', 'text-sky-300', 'text-amber-300', 'text-pink-300', 'text-violet-300', 'text-orange-300', 'text-teal-300', 'text-lime-300']
const nameColor = (id = '') => NAME_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length]
const time = (d) => new Date(d).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })

// WhatsApp-স্টাইল গ্রুপ চ্যাট (রিয়েলটাইম)
export default function GroupChat({ groupId, who }) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(null)
  const end = useRef(), file = useRef()

  const markRead = useCallback(() => { supabase.rpc('mark_group_read', { p_group: groupId }) }, [groupId])
  const add = useCallback((m) => setMsgs((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l)), [])

  useEffect(() => {
    setMsgs(null)
    supabase.from('group_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { setMsgs((data || []).reverse()); if (error) setErr(error.message); markRead() })
    const ch = supabase.channel(`gchat-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (p) => { setMsgs((l) => (l && !l.some((x) => x.id === p.new.id) ? [...l, p.new] : l)); if (p.new.sender_id !== user.id) markRead() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [groupId, user.id, markRead])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs?.length])

  const send = async (fields) => {
    setErr('')
    const { data, error } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: user.id, ...fields }).select().single()
    if (error) return setErr('মেসেজ পাঠানো যায়নি')
    add(data); playSend()
  }
  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim(); if (!t) return
    setText(''); await send({ content: t })
  }
  const pickImage = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/') || f.size > 10 * 1048576) return setErr('১০MB-এর মধ্যে ছবি দিন')
    setBusy(true)
    try {
      const path = `${user.id}/g-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${extOf(f)}`
      const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type })
      if (error) throw error
      await send({ media_url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl, media_type: 'image' })
    } catch (er) { setErr(er.message) } finally { setBusy(false) }
  }

  let lastDay = ''
  return (
    <div className="flex h-[calc(100dvh-20rem)] min-h-[360px] flex-col overflow-hidden rounded-[28px] bg-ink/40 shadow-soft ring-1 ring-fg/5">
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {msgs === null && <p className="py-8 text-center text-fg/50">লোড হচ্ছে…</p>}
        {msgs?.length === 0 && <p className="py-8 text-center text-fg/50">এখনও কোনো মেসেজ নেই। প্রথম মেসেজটি আপনিই পাঠান 👋</p>}
        {msgs?.map((m, i) => {
          const mine = m.sender_id === user.id
          const day = new Date(m.created_at).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long' })
          const sep = day !== lastDay; lastDay = day
          const showName = !mine && msgs[i - 1]?.sender_id !== m.sender_id
          return (
            <div key={m.id}>
              {sep && <p className="my-2 text-center text-xs text-fg/40">{day}</p>}
              <div className={`flex ${mine ? 'justify-end' : ''}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${mine ? 'rounded-tr-sm bg-bubble text-white' : 'rounded-tl-sm bg-surface2'}`}>
                  {showName && <p className={`mb-0.5 text-xs font-bold ${nameColor(m.sender_id)}`}>{who[m.sender_id]?.full_name || 'সদস্য'}</p>}
                  {m.media_url && <img src={m.media_url} alt="" loading="lazy" onClick={() => setZoom(m.media_url)} className="mb-1 max-h-64 cursor-zoom-in rounded-2xl object-cover" />}
                  {m.content && <p className="whitespace-pre-wrap break-words">{linkify(m.content)}</p>}
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/60' : 'text-fg/45'}`}>{time(m.created_at)}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {err && <p className="px-4 pb-1 text-sm text-danger">{err}</p>}
      <form onSubmit={submit} className="flex items-center gap-2 bg-surface p-3">
        <input ref={file} type="file" accept="image/*" hidden onChange={pickImage} />
        <button type="button" disabled={busy} onClick={() => file.current.click()} aria-label="ছবি" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 text-brand disabled:opacity-50"><ImagePlus size={21} /></button>
        <input className="input" placeholder="মেসেজ লিখুন…" value={text} onChange={(e) => setText(e.target.value)} />
        <button aria-label="পাঠান" className="btn-primary !px-4"><Send size={20} /></button>
      </form>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}
