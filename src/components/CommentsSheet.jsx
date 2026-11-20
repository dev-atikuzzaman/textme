import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Send, Paperclip, CornerDownRight, ChevronUp } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { extOf, fmtSize, mediaPathFromUrl } from '../lib/media'
import { uploadToStorage, friendlyUploadError, MAX_UPLOAD } from '../lib/upload'
import Avatar from './Avatar'
import CommentItem from './post/CommentItem'

const bn = (n) => n.toLocaleString('bn-BD')

export default function CommentsSheet({ post, onClose, onChange }) {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [viewer, setViewer] = useState(null)
  const [replyTo, setReplyTo] = useState(null) // { parentId, userId, name, targetId }
  const [open, setOpen] = useState(() => new Set())
  const scrollTo = useRef(null)
  const picker = useRef()
  const input = useRef()
  const box = useRef()

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('comments')
      .select('*, profiles!comments_user_id_fkey(id,full_name,avatar_url), comment_reactions(user_id,type)')
      .eq('post_id', post.id).order('created_at')
    if (error) setErr('কমেন্ট লোড করা যায়নি: ' + error.message)
    setItems(data || [])
  }, [post.id])
  useEffect(() => { load() }, [load])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  // নতুন কমেন্ট/উত্তর যোগ হলে সেখানে স্ক্রল
  useEffect(() => {
    if (!scrollTo.current || !items) return
    const id = scrollTo.current; scrollTo.current = null
    setTimeout(() => box.current?.querySelector(`[data-cid="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }, [items])

  const { tops, kids, names } = useMemo(() => {
    const list = items || []
    const kids = {}
    list.filter((c) => c.parent_id).forEach((c) => (kids[c.parent_id] ||= []).push(c))
    return { tops: list.filter((c) => !c.parent_id), kids, names: Object.fromEntries(list.map((c) => [c.user_id, c.profiles?.full_name])) }
  }, [items])
  const nameOf = (id) => names[id] || 'ব্যবহারকারী'

  const pickFile = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setErr('')
    if (f.size > MAX_UPLOAD) return setErr(`ফাইলটি ${(f.size / 1048576).toFixed(1)}MB — সর্বোচ্চ ৫০MB`)
    setFile(f); setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }
  const clearFile = () => { setFile(null); setPreview(null) }

  const startReply = (parent, target) => {
    setReplyTo({ parentId: parent.id, userId: target.user_id, name: target.profiles?.full_name || 'ব্যবহারকারী', targetId: target.id })
    setOpen((s) => new Set(s).add(parent.id))
    setTimeout(() => input.current?.focus(), 50)
  }
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const send = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if ((!t && !file) || busy) return
    setErr(''); setBusy(true); setPct(0)
    let path = null
    try {
      let media = {}
      if (file) {
        path = `${user.id}/c-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extOf(file)}`
        await uploadToStorage('media', path, file, setPct)
        media = {
          media_url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl,
          media_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
          media_name: file.name, media_size: file.size,
        }
      }
      const reply = replyTo ? { parent_id: replyTo.parentId, reply_to: replyTo.userId } : {}
      const { data, error } = await supabase.from('comments')
        .insert({ post_id: post.id, user_id: user.id, content: t || null, ...media, ...reply }).select('id').single()
      if (error) { if (path) supabase.storage.from('media').remove([path]); throw error }
      scrollTo.current = data.id
      if (replyTo) setOpen((s) => new Set(s).add(replyTo.parentId))
      setText(''); clearFile(); setReplyTo(null)
      await load(); onChange?.()
    } catch (er) {
      setErr(/column|schema cache|check constraint|null value|violates/i.test(er.message || '') ? 'নতুন SQL চালানো হয়নি — update-9.sql ও update-10.sql চালান' : friendlyUploadError(er))
    } finally { setBusy(false) }
  }

  const del = async (c) => {
    const replies = kids[c.id] || []
    if (replies.length && !window.confirm(`এই কমেন্টের ${bn(replies.length)}টি উত্তরও মুছে যাবে। মুছবেন?`)) return
    const paths = [c, ...replies].map((x) => mediaPathFromUrl(x.media_url)).filter(Boolean)
    const { error } = await supabase.from('comments').delete().eq('id', c.id)
    if (error) return setErr(error.message)
    if (paths.length) supabase.storage.from('media').remove(paths)
    if (replyTo && (replyTo.parentId === c.id || replyTo.targetId === c.id)) setReplyTo(null)
    await load(); onChange?.()
  }

  const row = (c, isReply, parent) => (
    <CommentItem key={c.id} c={c} isReply={isReply} postOwnerId={post.user_id} parentAuthorId={parent?.user_id} nameOf={nameOf}
      active={replyTo?.targetId === c.id} canDelete={c.user_id === user.id || post.user_id === user.id}
      onDelete={() => del(c)} onReply={() => startReply(parent || c, c)} onOpenImage={setViewer} />
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[32px] bg-surface ring-1 ring-fg/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold">কমেন্ট{items?.length ? <span className="ml-2 text-sm font-semibold text-fg/50">{bn(items.length)}</span> : null}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>

        <div ref={box} className="min-h-[140px] flex-1 space-y-5 overflow-y-auto px-5 py-3">
          {items === null && <p className="text-center text-fg/50">লোড হচ্ছে…</p>}
          {items?.length === 0 && <p className="py-6 text-center text-fg/60">এখনও কোনো কমেন্ট নেই। প্রথম কমেন্টটি আপনি করুন।</p>}
          {tops.map((c) => {
            const replies = kids[c.id] || []
            const isOpen = open.has(c.id)
            const repliers = [...new Map(replies.map((r) => [r.user_id, r.profiles])).values()].slice(0, 3)
            return (
              <div key={c.id}>
                {row(c, false)}
                {replies.length > 0 && (
                  <div className="ml-[18px] mt-3 border-l-2 border-brand/25 pl-4">
                    {isOpen ? (
                      <div className="pop-in space-y-4">
                        {replies.map((r) => row(r, true, c))}
                        <button onClick={() => toggle(c.id)} className="flex items-center gap-1.5 text-xs font-bold text-fg/55"><ChevronUp size={14} />উত্তর লুকান</button>
                      </div>
                    ) : (
                      <button onClick={() => toggle(c.id)} className="flex items-center gap-2 rounded-full bg-surface2 py-1.5 pl-2 pr-3 text-xs font-bold text-brand transition active:scale-95">
                        <span className="flex -space-x-2">{repliers.map((p, i) => <span key={i} className="rounded-full ring-2 ring-surface2"><Avatar p={p} size={20} /></span>)}</span>
                        <CornerDownRight size={13} />{bn(replies.length)}টি উত্তর দেখুন
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {replyTo && (
          <div className="pop-in mx-4 mb-1 flex items-center gap-2 rounded-2xl bg-brand/10 px-3 py-2 text-sm">
            <CornerDownRight size={16} className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate"><b className="text-brand">{replyTo.name}</b> কে উত্তর দিচ্ছেন</span>
            <button onClick={() => setReplyTo(null)} className="grid h-6 w-6 place-items-center rounded-full bg-surface2"><X size={14} /></button>
          </div>
        )}
        {file && (
          <div className="mx-4 mb-1 flex items-center gap-3 rounded-2xl bg-surface2 p-2.5">
            {preview ? <img src={preview} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-brand"><Paperclip size={20} /></span>}
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{file.name}</b><span className="text-xs text-fg/55">{fmtSize(file.size)}</span></span>
            <button disabled={busy} onClick={clearFile} className="grid h-8 w-8 place-items-center rounded-full bg-surface text-fg/60"><X size={16} /></button>
          </div>
        )}
        {busy && file && <div className="mx-4 mb-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-brand to-coral transition-all" style={{ width: `${pct}%` }} /></div>}
        {err && <p className="px-5 pb-1 text-sm text-danger">{err}</p>}

        <form onSubmit={send} className="flex items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input ref={picker} type="file" hidden onChange={pickFile} />
          <button type="button" disabled={busy} onClick={() => picker.current.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 text-brand"><Paperclip size={20} /></button>
          <input ref={input} className="input" placeholder={replyTo ? 'উত্তর লিখুন…' : 'কমেন্ট লিখুন…'} value={text} onChange={(e) => setText(e.target.value)} />
          <button disabled={busy} className="btn-primary !px-4"><Send size={20} /></button>
        </form>
      </div>
      {viewer && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-4" onClick={(e) => { e.stopPropagation(); setViewer(null) }}><img src={viewer} alt="" className="max-h-full max-w-full" /></div>}
    </div>
  )
}
