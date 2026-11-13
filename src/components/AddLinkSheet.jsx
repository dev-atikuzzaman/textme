import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { parseFacebook } from '../lib/youtube'

export default function AddLinkSheet({ onClose, onDone }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const link = parseFacebook(text)
    if (!link) return setErr('এটি ফেসবুকের লিংক মনে হচ্ছে না')
    setBusy(true); setErr('')
    const { error } = await supabase.from('external_videos')
      .insert({ source: 'facebook', external_id: link, url: link, feeds: ['shared'], added_by: user.id })
    setBusy(false)
    if (error && error.code !== '23505') return setErr(error.message) // 23505 = আগেই যোগ করা আছে
    onDone?.(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[32px] bg-mist p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">ফেসবুক রিলের লিংক</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white"><X size={18} /></button>
        </div>
        <textarea className="input min-h-24" placeholder="ফেসবুক রিল বা ভিডিওর লিংক এখানে পেস্ট করুন" value={text} onChange={(e) => { setText(e.target.value); setErr('') }} />
        {err && <p className="mt-2 text-sm text-coral">{err}</p>}
        <button className="btn-primary mt-3 w-full" disabled={busy || !text.trim()} onClick={submit}>{busy ? 'যোগ হচ্ছে…' : 'যোগ করুন'}</button>
      </div>
    </div>
  )
}
