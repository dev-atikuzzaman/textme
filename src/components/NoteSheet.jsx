import { useRef, useState } from 'react'
import { X, ImagePlus, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { uploadToStorage, friendlyUploadError } from '../lib/upload'
import { extOf } from '../lib/media'
import { playPop } from '../lib/sound'
import PrivacyPicker from './PrivacyPicker'

// পুরোনো ফেসবুকের "নোট": শিরোনাম + লম্বা লেখা + কভার ছবি
export default function NoteSheet({ groupId, pageId, onClose, onDone }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [privacy, setPrivacy] = useState(groupId ? 'friends' : pageId ? 'public' : 'friends')
  const [cover, setCover] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef()

  const pick = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('কভার হিসেবে শুধু ছবি দেওয়া যাবে')
    if (f.size > 10 * 1048576) return setErr('কভার ছবি সর্বোচ্চ ১০MB')
    setErr(''); setCover(f); setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    setErr('')
    if (!title.trim()) return setErr('নোটের শিরোনাম দিন')
    if (body.trim().length < 20) return setErr('নোট আরেকটু বিস্তারিত লিখুন (কমপক্ষে ২০ অক্ষর)')
    setBusy(true)
    let path = null
    try {
      let media = {}
      if (cover) {
        path = `${user.id}/note-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extOf(cover)}`
        await uploadToStorage('media', path, cover)
        media = { media_url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl, media_type: 'image', media_name: cover.name, media_size: cover.size }
      }
      const { error } = await supabase.from('posts').insert({
        user_id: user.id, kind: 'post', category: 'note', title: title.trim(), content: body.trim(), privacy, ...media,
        ...(groupId ? { group_id: groupId } : {}), ...(pageId ? { page_id: pageId } : {}),
      })
      if (error) { if (path) supabase.storage.from('media').remove([path]); throw error }
      playPop(); onDone?.(); onClose()
    } catch (e) { setErr(friendlyUploadError(e)) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="max-h-[94vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold"><FileText size={22} className="text-brand" />নতুন নোট</h2>
          <button disabled={busy} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 disabled:opacity-40"><X size={18} /></button>
        </div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
        {preview ? (
          <div className="relative"><img src={preview} alt="" className="h-40 w-full rounded-2xl object-cover" />
            <button onClick={() => { setCover(null); setPreview(null) }} className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">সরান</button></div>
        ) : (
          <button onClick={() => ref.current.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-surface2 py-4 text-sm font-semibold text-brand"><ImagePlus size={18} />কভার ছবি যোগ করুন (ঐচ্ছিক)</button>
        )}
        <input className="input !text-lg !font-bold" placeholder="নোটের শিরোনাম" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input min-h-[220px] leading-relaxed" placeholder="এখানে লিখুন… খালি লাইন দিলে নতুন অনুচ্ছেদ হবে। লিংক ও #ট্যাগ কাজ করবে।" value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="text-right text-xs text-fg/45">{body.length.toLocaleString('bn-BD')} অক্ষর</p>
        {!groupId && !pageId && <PrivacyPicker value={privacy} onChange={setPrivacy} />}
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy} onClick={submit} className="btn-primary w-full">{busy ? 'প্রকাশ হচ্ছে…' : 'নোট প্রকাশ করুন'}</button>
      </div>
    </div>
  )
}
