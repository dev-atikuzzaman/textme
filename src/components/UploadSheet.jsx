import { useRef, useState } from 'react'
import { X, ImagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { CATEGORIES } from '../lib/constants'
import PrivacyPicker from './PrivacyPicker'

const TITLES = { post: 'নতুন পোস্ট', reel: 'নতুন রিল', video: 'ভিডিও আপলোড' }

export default function UploadSheet({ kind = 'post', onClose, onDone }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [privacy, setPrivacy] = useState(kind === 'post' ? 'friends' : 'public')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef()
  const needsVideo = kind !== 'post'

  const submit = async () => {
    setErr('')
    if (needsVideo && !file) return setErr('একটি ভিডিও বেছে নিন')
    if (kind === 'video' && !title.trim()) return setErr('ভিডিওর শিরোনাম দিন')
    if (!file && !content.trim()) return setErr('কিছু লিখুন বা ছবি/ভিডিও যোগ করুন')
    if (file && file.size > 50 * 1024 * 1024) return setErr('ফাইল ৫০MB-এর বেশি হতে পারবে না')
    setBusy(true)
    try {
      let media_url = null, media_type = null
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`
        const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
        if (error) throw error
        media_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
        media_type = file.type.startsWith('video') ? 'video' : 'image'
      }
      const { error } = await supabase.from('posts').insert({
        user_id: user.id, kind, content: content.trim() || null, title: title.trim() || null,
        category: kind === 'post' ? null : category, privacy, media_url, media_type,
      })
      if (error) throw error
      onDone?.(); onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{TITLES[kind]}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        {kind === 'video' && <input className="input" placeholder="শিরোনাম" value={title} onChange={(e) => setTitle(e.target.value)} />}
        <textarea className="input min-h-[96px]" placeholder={kind === 'post' ? 'মনে কী আছে?' : 'বিবরণ (ঐচ্ছিক)'} value={content} onChange={(e) => setContent(e.target.value)} />
        {kind !== 'post' && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${category === c ? 'bg-ink text-white' : 'bg-mist'}`}>{c}</button>
            ))}
          </div>
        )}
        <input ref={ref} type="file" hidden accept={needsVideo ? 'video/*' : 'image/*,video/*'} onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={() => ref.current.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-mist py-5 font-semibold text-brand">
          <ImagePlus size={20} />{file ? file.name : needsVideo ? 'ভিডিও বেছে নিন' : 'ছবি বা ভিডিও যোগ করুন'}
        </button>
        <PrivacyPicker value={privacy} onChange={setPrivacy} />
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</p>}
        <button disabled={busy} onClick={submit} className="btn-primary w-full">{busy ? 'আপলোড হচ্ছে…' : 'প্রকাশ করুন'}</button>
      </div>
    </div>
  )
}
