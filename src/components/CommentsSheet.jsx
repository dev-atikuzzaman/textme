import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Send, Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { extOf, fmtSize, mediaPathFromUrl } from '../lib/media'
import { uploadToStorage, friendlyUploadError, MAX_UPLOAD } from '../lib/upload'
import CommentItem from './post/CommentItem'

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
  const end = useRef()
  const picker = useRef()

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('comments')
      .select('*, profiles!comments_user_id_fkey(id,full_name,avatar_url), comment_reactions(user_id,type)')
      .eq('post_id', post.id).order('created_at')
    if (error) setErr('কমেন্ট লোড করা যায়নি: ' + error.message)
    setItems(data || [])
  }, [post.id])
  useEffect(() => { load() }, [load])
  useEffect(() => { end.current?.scrollIntoView() }, [items?.length])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const pickFile = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setErr('')
    if (f.size > MAX_UPLOAD) return setErr(`ফাইলটি ${(f.size / 1048576).toFixed(1)}MB — সর্বোচ্চ ৫০MB`)
    setFile(f); setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }
  const clearFile = () => { setFile(null); setPreview(null) }

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
      const { error } = await supabase.from('comments').insert({ post_id: post.id, user_id: user.id, content: t || null, ...media })
      if (error) { if (path) supabase.storage.from('media').remove([path]); throw error }
      setText(''); clearFile()
      await load(); onChange?.()
    } catch (er) {
      setErr(/column|schema cache|check constraint|null value/i.test(er.message || '') ? 'update-9.sql চালানো হয়নি — Supabase-এ চালান' : friendlyUploadError(er))
    } finally { setBusy(false) }
  }

  const del = async (c) => {
    const p = mediaPathFromUrl(c.media_url)
    await supabase.from('comments').delete().eq('id', c.id)
    if (p) supabase.storage.from('media').remove([p])
    await load(); onChange?.()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[32px] bg-surface ring-1 ring-fg/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold">কমেন্ট</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <div className="min-h-[140px] flex-1 space-y-5 overflow-y-auto px-5 py-3">
          {items === null && <p className="text-center text-fg/50">লোড হচ্ছে…</p>}
          {items?.length === 0 && <p className="py-6 text-center text-fg/60">এখনও কোনো কমেন্ট নেই। প্রথম কমেন্টটি আপনি করুন।</p>}
          {items?.map((c) => (
            <CommentItem key={c.id} c={c} canDelete={c.user_id === user.id || post.user_id === user.id} onDelete={() => del(c)} onOpenImage={setViewer} />
          ))}
          <div ref={end} />
        </div>

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
          <input className="input" placeholder="কমেন্ট লিখুন…" value={text} onChange={(e) => setText(e.target.value)} />
          <button disabled={busy} className="btn-primary !px-4"><Send size={20} /></button>
        </form>
      </div>
      {viewer && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-4" onClick={(e) => { e.stopPropagation(); setViewer(null) }}><img src={viewer} alt="" className="max-h-full max-w-full" /></div>}
    </div>
  )
}
