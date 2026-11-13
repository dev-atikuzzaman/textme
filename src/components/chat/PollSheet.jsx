import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'

export default function PollSheet({ onClose, onCreate }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState(['', ''])
  const filled = opts.map((o) => o.trim()).filter(Boolean)
  const valid = q.trim() && filled.length >= 2
  const set = (i, v) => setOpts(opts.map((o, j) => (j === i ? v : o)))
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[32px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">পোল তৈরি করুন</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        <input className="input" placeholder="প্রশ্ন লিখুন" value={q} onChange={(e) => setQ(e.target.value)} maxLength={150} />
        {opts.map((o, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" placeholder={`অপশন ${i + 1}`} value={o} onChange={(e) => set(i, e.target.value)} maxLength={80} />
            {opts.length > 2 && <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="px-2 text-ink/40"><Trash2 size={18} /></button>}
          </div>
        ))}
        {opts.length < 6 && (
          <button onClick={() => setOpts([...opts, ''])} className="flex items-center gap-2 font-semibold text-brand"><Plus size={18} />অপশন যোগ করুন</button>
        )}
        <button disabled={!valid} onClick={() => onCreate({ question: q.trim(), options: filled })} className="btn-primary w-full">পোল পাঠান</button>
      </div>
    </div>
  )
}
