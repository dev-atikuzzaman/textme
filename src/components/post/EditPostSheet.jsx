import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PrivacyPicker from '../PrivacyPicker'

export default function EditPostSheet({ post, onClose, onSaved }) {
  const [content, setContent] = useState(post.content || '')
  const [title, setTitle] = useState(post.title || '')
  const [privacy, setPrivacy] = useState(post.privacy)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    if (!post.media_url && !content.trim()) return setErr('পোস্ট খালি রাখা যাবে না')
    setBusy(true)
    const patch = { content: content.trim() || null, privacy, edited_at: new Date().toISOString() }
    if (post.kind === 'video') patch.title = title.trim() || null
    const { error } = await supabase.from('posts').update(patch).eq('id', post.id)
    setBusy(false)
    if (error) return setErr(/policy|permission|row-level/i.test(error.message) ? 'এডিটের অনুমতি নেই — update-8.sql চালান' : error.message)
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[66] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">পোস্ট এডিট</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        {post.kind === 'video' && <input className="input" placeholder="শিরোনাম" value={title} onChange={(e) => setTitle(e.target.value)} />}
        <textarea className="input min-h-[140px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="কী লিখতে চান?" autoFocus />
        {post.media_url && <p className="text-xs text-ink/50">ছবি/ভিডিও বদলানো যায় না — শুধু লেখা ও গোপনীয়তা এডিট হবে।</p>}
        <PrivacyPicker value={privacy} onChange={setPrivacy} />
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{err}</p>}
        <button disabled={busy} onClick={save} className="btn-primary w-full">{busy ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
      </div>
    </div>
  )
}
