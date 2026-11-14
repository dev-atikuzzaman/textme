import { useEffect, useRef, useState } from 'react'
import { X, ImagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { CATEGORIES } from '../lib/constants'
import { uploadToStorage, friendlyUploadError, MAX_UPLOAD } from '../lib/upload'
import { extOf, fmtSize } from '../lib/media'
import PrivacyPicker from './PrivacyPicker'

const TITLES = { post: 'নতুন পোস্ট', reel: 'নতুন রিল', video: 'ভিডিও আপলোড' }
const mb = (b) => (b / 1048576).toFixed(1)

export default function UploadSheet({ kind = 'post', accept, autoPick, onClose, onDone }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [privacy, setPrivacy] = useState(kind === 'post' ? 'friends' : 'public')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState('')
  const ref = useRef()
  const needsVideo = kind !== 'post'
  useEffect(() => { if (autoPick) ref.current?.click() }, []) // eslint-disable-line

  const pick = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setErr('')
    if (needsVideo && !f.type.startsWith('video/')) return setErr('শুধু ভিডিও ফাইল বাছুন')
    if (f.size > MAX_UPLOAD) return setErr(`ফাইলটি ${mb(f.size)}MB — সর্বোচ্চ ৫০MB। ছোট ভিডিও বাছুন বা ভিডিও কমপ্রেস করুন।`)
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  const submit = async () => {
    setErr('')
    if (needsVideo && !file) return setErr('একটি ভিডিও বেছে নিন')
    if (kind === 'video' && !title.trim()) return setErr('ভিডিওর শিরোনাম দিন')
    if (!file && !content.trim()) return setErr('কিছু লিখুন বা ছবি/ভিডিও যোগ করুন')
    setBusy(true); setPct(0)
    let path = null
    try {
      let media_url = null, media_type = null, media_name = null, media_size = null
      if (file) {
        path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extOf(file)}`
        await uploadToStorage('media', path, file, setPct)
        media_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
        media_name = file.name; media_size = file.size
        media_type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file'
      }
      const { error } = await supabase.from('posts').insert({
        user_id: user.id, kind, content: content.trim() || null, title: title.trim() || null,
        category: kind === 'post' ? null : category, privacy, media_url, media_type, media_name, media_size,
      })
      if (error) {
        if (path) supabase.storage.from('media').remove([path]) // অপ্রয়োজনীয় ফাইল জমে না থাকার জন্য
        throw error
      }
      onDone?.(); onClose()
    } catch (e) { setErr(friendlyUploadError(e)) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{TITLES[kind]}</h2>
          <button disabled={busy} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 disabled:opacity-40"><X size={18} /></button>
        </div>
        {kind === 'video' && <input className="input" placeholder="শিরোনাম" value={title} onChange={(e) => setTitle(e.target.value)} />}
        <textarea className="input min-h-[96px]" placeholder={kind === 'post' ? 'মনে কী আছে?' : 'বিবরণ (ঐচ্ছিক)'} value={content} onChange={(e) => setContent(e.target.value)} />
        {kind !== 'post' && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${category === c ? 'bg-ink text-white' : 'bg-surface2'}`}>{c}</button>
            ))}
          </div>
        )}
        <input ref={ref} type="file" hidden accept={accept ?? (needsVideo ? 'video/*' : undefined)} onChange={pick} />
        <button disabled={busy} onClick={() => ref.current.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-surface2 py-5 font-semibold text-brand">
          <ImagePlus size={20} />
          <span className="min-w-0 truncate">{file ? `${file.name} (${mb(file.size)}MB)` : needsVideo ? 'ভিডিও বেছে নিন' : 'ছবি, ভিডিও বা যেকোনো ফাইল যোগ করুন'}</span>
        </button>
        {preview && <img src={preview} alt="" className="max-h-48 w-full rounded-2xl object-cover" />}
        <PrivacyPicker value={privacy} onChange={setPrivacy} />
        {busy && file && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-brand to-coral text-inverse transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-center text-xs text-fg/60">আপলোড হচ্ছে… {pct}% — পেজ বন্ধ করবেন না</p>
          </div>
        )}
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy} onClick={submit} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : 'প্রকাশ করুন'}</button>
      </div>
    </div>
  )
}
