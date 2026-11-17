import { useRef, useState } from 'react'
import { X, ImagePlus, Trash2, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { CATEGORIES } from '../../lib/constants'
import { uploadToStorage, friendlyUploadError, MAX_UPLOAD } from '../../lib/upload'
import { extOf } from '../../lib/media'
import PrivacyPicker from '../PrivacyPicker'

const mb = (b) => (b / 1048576).toFixed(1)
const pathOf = (url) => { const m = url?.match(/\/media\/(.+?)(\?|$)/); return m ? decodeURIComponent(m[1]) : null }

// পোস্ট/নোট/রিল/ভিডিও — যা যা লেখা হয়েছে সবই এডিট করা যায়: শিরোনাম, লেখা, ক্যাটাগরি, ছবি/ভিডিও/কভার, গোপনীয়তা
export default function EditPostSheet({ post, onClose, onSaved }) {
  const { user } = useAuth()
  const isNote = post.category === 'note'
  const isReel = post.kind === 'reel', isVideo = post.kind === 'video'
  const hasTitle = isVideo || isNote || !!post.title
  const [content, setContent] = useState(post.content || '')
  const [title, setTitle] = useState(post.title || '')
  const [category, setCategory] = useState(post.category || CATEGORIES[0])
  const [privacy, setPrivacy] = useState(post.privacy)
  const [newFile, setNewFile] = useState(null)
  const [preview, setPreview] = useState(null) // {url, type}
  const [removed, setRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const ref = useRef()
  const mustHaveVideo = isReel || isVideo
  const accept = mustHaveVideo ? 'video/*' : isNote ? 'image/*' : undefined
  const showMedia = !removed && !newFile && post.media_url

  const pick = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (mustHaveVideo && !f.type.startsWith('video/')) return setErr('শুধু ভিডিও ফাইল বাছুন')
    if (isNote && !f.type.startsWith('image/')) return setErr('কভার হিসেবে শুধু ছবি দেওয়া যাবে')
    if (f.size > MAX_UPLOAD) return setErr(`ফাইলটি ${mb(f.size)}MB — সর্বোচ্চ ৫০MB`)
    setErr(''); setNewFile(f); setRemoved(false)
    setPreview({ url: URL.createObjectURL(f), type: f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : 'file' })
  }
  const undo = () => { setNewFile(null); setPreview(null); setRemoved(false) }

  const save = async () => {
    setErr('')
    if (hasTitle && (isVideo || isNote) && !title.trim()) return setErr(isNote ? 'নোটের শিরোনাম দিন' : 'ভিডিওর শিরোনাম দিন')
    if (isNote && content.trim().length < 20) return setErr('নোট আরেকটু বিস্তারিত লিখুন (কমপক্ষে ২০ অক্ষর)')
    const willHaveMedia = newFile || (post.media_url && !removed)
    if (mustHaveVideo && !willHaveMedia) return setErr('ভিডিও ছাড়া রাখা যাবে না')
    if (!willHaveMedia && !content.trim()) return setErr('পোস্ট খালি রাখা যাবে না')
    setBusy(true); setPct(0)
    let newPath = null
    try {
      const patch = { content: content.trim() || null, privacy, edited_at: new Date().toISOString() }
      if (hasTitle) patch.title = title.trim() || null
      if (isReel || isVideo) patch.category = category
      if (newFile) {
        newPath = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extOf(newFile)}`
        await uploadToStorage('media', newPath, newFile, setPct)
        patch.media_url = supabase.storage.from('media').getPublicUrl(newPath).data.publicUrl
        patch.media_name = newFile.name; patch.media_size = newFile.size
        patch.media_type = newFile.type.startsWith('video/') ? 'video' : newFile.type.startsWith('image/') ? 'image' : 'file'
      } else if (removed) {
        patch.media_url = null; patch.media_type = null; patch.media_name = null; patch.media_size = null
      }
      const { error } = await supabase.from('posts').update(patch).eq('id', post.id)
      if (error) { if (newPath) supabase.storage.from('media').remove([newPath]); throw error }
      if ((newFile || removed) && post.media_url) { const old = pathOf(post.media_url); if (old) supabase.storage.from('media').remove([old]) } // পুরোনো ফাইল জমে থাকে না
      onSaved?.(); onClose()
    } catch (e) {
      setErr(/policy|permission|row-level/i.test(e.message || '') ? 'এডিটের অনুমতি নেই — update-8.sql চালান' : friendlyUploadError(e))
    } finally { setBusy(false) }
  }

  const label = mustHaveVideo ? 'ভিডিও' : isNote ? 'কভার ছবি' : 'ছবি/ভিডিও/ফাইল'
  return (
    <div className="fixed inset-0 z-[66] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="pop-in max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{isNote ? 'নোট এডিট' : isReel ? 'রিল এডিট' : isVideo ? 'ভিডিও এডিট' : 'পোস্ট এডিট'}</h2>
          <button disabled={busy} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 disabled:opacity-40"><X size={18} /></button>
        </div>
        {hasTitle && <input className="input" placeholder="শিরোনাম" value={title} onChange={(e) => setTitle(e.target.value)} />}
        <textarea className={`input ${isNote ? 'min-h-[200px]' : 'min-h-[120px]'}`} value={content} onChange={(e) => setContent(e.target.value)} placeholder={isNote ? 'নোটের লেখা' : 'কী লিখতে চান?'} />
        {(isReel || isVideo) && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {CATEGORIES.map((c) => <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${category === c ? 'bg-ink text-white' : 'bg-surface2'}`}>{c}</button>)}
          </div>
        )}

        <input ref={ref} type="file" hidden accept={accept} onChange={pick} />
        {(showMedia || preview) && (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {preview
              ? preview.type === 'video' ? <video src={preview.url} controls playsInline className="max-h-56 w-full" /> : preview.type === 'image' ? <img src={preview.url} alt="" className="max-h-56 w-full object-cover" /> : <p className="p-4 text-sm text-white">{newFile?.name}</p>
              : post.media_type === 'video' ? <video src={post.media_url} controls playsInline className="max-h-56 w-full" /> : post.media_type === 'image' ? <img src={post.media_url} alt="" className="max-h-56 w-full object-cover" /> : <p className="p-4 text-sm text-white">{post.media_name || 'ফাইল'}</p>}
          </div>
        )}
        {removed && <p className="rounded-xl bg-surface2 p-3 text-sm text-fg/70">{label} মুছে ফেলা হবে।</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => ref.current.click()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand/10 py-3 text-sm font-bold text-brand">
            <ImagePlus size={18} />{post.media_url || newFile ? `${label} বদলান` : `${label} যোগ করুন`}
          </button>
          {(newFile || removed) && <button disabled={busy} onClick={undo} className="flex items-center gap-1.5 rounded-2xl bg-surface2 px-4 text-sm font-semibold"><Undo2 size={16} />আগেরটা</button>}
          {!mustHaveVideo && showMedia && <button disabled={busy} onClick={() => setRemoved(true)} className="flex items-center gap-1.5 rounded-2xl bg-danger/10 px-4 text-sm font-semibold text-danger"><Trash2 size={16} />মুছুন</button>}
        </div>

        <PrivacyPicker value={privacy} onChange={setPrivacy} />
        {busy && newFile && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-brand to-coral transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-center text-xs text-fg/60">আপলোড হচ্ছে… {pct}%</p>
          </div>
        )}
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy} onClick={save} className="btn-primary w-full">{busy ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
      </div>
    </div>
  )
}
