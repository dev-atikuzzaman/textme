import { useRef, useState } from 'react'
import { X, Type, ImagePlus, Globe, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { uploadToStorage, friendlyUploadError, MAX_UPLOAD } from '../../lib/upload'
import { extOf } from '../../lib/media'
import { STORY_BG } from './storyUtils'

export default function StoryComposer({ onClose, onDone }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [bg, setBg] = useState(0)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [privacy, setPrivacy] = useState('friends')
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const ref = useRef()

  const pick = (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (!/^(image|video)\//.test(f.type)) return setErr('শুধু ছবি বা ভিডিও বাছুন')
    if (f.size > MAX_UPLOAD) return setErr('ফাইল সর্বোচ্চ ৫০MB হতে পারবে')
    setErr(''); setFile(f); setPreview({ url: URL.createObjectURL(f), video: f.type.startsWith('video/') })
  }

  const submit = async () => {
    setErr('')
    if (mode === 'text' && !text.trim()) return setErr('কিছু লিখুন')
    if (mode === 'media' && !file) return setErr('একটি ছবি বা ভিডিও বাছুন')
    setBusy(true); setPct(0)
    let path = null
    try {
      let media_url = null, media_type = null
      if (mode === 'media') {
        path = `${user.id}/story-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extOf(file)}`
        await uploadToStorage('media', path, file, setPct)
        media_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
        media_type = file.type.startsWith('video/') ? 'video' : 'image'
      }
      const { error } = await supabase.from('stories').insert({
        user_id: user.id, content: text.trim() || null, bg, media_url, media_type, privacy,
      })
      if (error) {
        if (path) supabase.storage.from('media').remove([path])
        throw /relation|schema cache|does not exist/i.test(error.message) ? new Error('স্টোরি টেবিল নেই — update-12.sql চালান') : error
      }
      onDone?.(); onClose()
    } catch (e) { setErr(friendlyUploadError(e)) } finally { setBusy(false) }
  }

  const tab = (id, Icon, label) => (
    <button onClick={() => setMode(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold ${mode === id ? 'bg-gradient-to-r from-brand to-coral text-inverse' : 'bg-surface2'}`}><Icon size={18} />{label}</button>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">নতুন স্টোরি</h2>
          <button disabled={busy} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <div className="flex gap-2">{tab('text', Type, 'লেখা')}{tab('media', ImagePlus, 'ছবি/ভিডিও')}</div>

        {mode === 'text' ? (
          <>
            <div className="grid h-60 place-items-center rounded-3xl p-5" style={{ background: STORY_BG[bg] }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="কী ভাবছেন?" rows={4}
                className="w-full resize-none bg-transparent text-center text-2xl font-bold text-white outline-none placeholder:text-white/60" />
            </div>
            <div className="flex justify-center gap-3">
              {STORY_BG.map((b, i) => <button key={i} aria-label={`রং ${i + 1}`} onClick={() => setBg(i)} style={{ background: b }} className={`h-8 w-8 rounded-full ${bg === i ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : ''}`} />)}
            </div>
          </>
        ) : (
          <>
            <input ref={ref} type="file" hidden accept="image/*,video/*" onChange={pick} />
            {preview ? (
              <div className="relative overflow-hidden rounded-3xl bg-black">
                {preview.video ? <video src={preview.url} className="max-h-72 w-full object-contain" muted playsInline controls /> : <img src={preview.url} alt="" className="max-h-72 w-full object-contain" />}
                <button onClick={() => ref.current.click()} className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">বদলান</button>
              </div>
            ) : (
              <button onClick={() => ref.current.click()} className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand/40 bg-surface2 py-12 font-semibold text-brand"><ImagePlus size={22} />ছবি বা ভিডিও বেছে নিন</button>
            )}
            <input className="input" placeholder="ক্যাপশন (ঐচ্ছিক)" maxLength={120} value={text} onChange={(e) => setText(e.target.value)} />
          </>
        )}

        <div className="flex gap-2">
          {[['friends', Users, 'বন্ধুরা'], ['public', Globe, 'পাবলিক']].map(([id, Icon, label]) => (
            <button key={id} onClick={() => setPrivacy(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold ${privacy === id ? 'bg-ink text-white' : 'bg-surface2'}`}><Icon size={16} />{label}</button>
          ))}
        </div>
        <p className="text-center text-xs text-fg/50">স্টোরি ২৪ ঘণ্টা পর আর দেখা যাবে না</p>

        {busy && mode === 'media' && <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-brand to-coral transition-all" style={{ width: `${pct}%` }} /></div>}
        {err && <p className="rounded-xl bg-danger/15 p-3 text-sm text-danger">{err}</p>}
        <button disabled={busy} onClick={submit} className="btn-primary w-full">{busy ? 'অপেক্ষা করুন…' : 'স্টোরি দিন'}</button>
      </div>
    </div>
  )
}
