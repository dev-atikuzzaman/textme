import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast, errMsg } from '../lib/ui'

const REASONS = ['স্প্যাম বা বিরক্তিকর', 'হয়রানি বা ভয় দেখানো', 'আপত্তিকর বা অশোভন কনটেন্ট', 'ভুয়া অ্যাকাউন্ট / অন্য কেউ সেজে আছে', 'অন্য কারণ']

// রিপোর্ট করুন: type = 'user' | 'post'। রিপোর্ট শুধু অ্যাডমিন দেখেন, যাকে রিপোর্ট করা হলো সে জানতে পারে না
export default function ReportSheet({ type, targetId, userId, title, onClose }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!reason) return toast('একটি কারণ বেছে নিন')
    setBusy(true)
    const { error } = await supabase.from('reports').insert({
      target_type: type, target_id: targetId, reported_user_id: userId || null, reason, note: note.trim() || null,
    })
    setBusy(false)
    if (error) {
      if (error.code === '23505') { toast.success('আপনি আগেই রিপোর্ট করেছেন — আমরা দেখছি'); return onClose() }
      return toast.error(/relation|schema cache|does not exist/i.test(error.message || '') ? 'রিপোর্ট চালু হয়নি — update-22.sql চালানো হয়নি' : errMsg(error))
    }
    toast.success('রিপোর্ট পাঠানো হয়েছে। ধন্যবাদ, আমরা দেখব।')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="রিপোর্ট"
        className="pop-in max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="truncate text-lg font-bold">{title || 'রিপোর্ট করুন'}</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <p className="text-sm text-fg/65">কেন রিপোর্ট করছেন? আপনার পরিচয় গোপন থাকবে।</p>
        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r}
              className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left font-semibold ${reason === r ? 'bg-brand/15 text-brand ring-2 ring-brand' : 'bg-surface2'}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${reason === r ? 'border-brand' : 'border-fg/30'}`}>{reason === r && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>
              {r}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="চাইলে আরও কিছু লিখুন (ঐচ্ছিক)" className="input" />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-soft flex-1">বাতিল</button>
          <button onClick={submit} disabled={busy || !reason} className="btn-primary flex-1">{busy ? 'পাঠানো হচ্ছে…' : 'রিপোর্ট পাঠান'}</button>
        </div>
      </div>
    </div>
  )
}
