import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'

// চ্যাটের ভেতরে লেখা খোঁজা (লোড হওয়া মেসেজের মধ্যে); পেলে ঐ মেসেজে স্ক্রল করে হাইলাইট করে
export default function ChatSearchBar({ msgs, onJump, onClose }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return msgs.filter((m) => m.type !== 'call' && m.content && String(m.content).toLowerCase().includes(s)).map((m) => m.id)
  }, [q, msgs])

  useEffect(() => { setI(hits.length ? hits.length - 1 : 0) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps -- সবচেয়ে নতুন ফলাফল থেকে শুরু
  useEffect(() => { if (hits[i]) onJump(hits[i]) }, [i, hits.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const bn = (n) => n.toLocaleString('bn-BD')
  return (
    <div className="flex items-center gap-2 border-b border-fg/5 bg-surface px-3 py-2">
      <Search size={18} className="shrink-0 text-fg/50" />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="এই চ্যাটে খুঁজুন…" aria-label="চ্যাটে খুঁজুন"
        className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-fg/40" />
      <span className="shrink-0 text-xs text-fg/55">{hits.length ? `${bn(i + 1)}/${bn(hits.length)}` : q.trim() ? 'পাওয়া যায়নি' : ''}</span>
      <button disabled={i <= 0} onClick={() => setI(i - 1)} aria-label="আগের ফলাফল" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 disabled:opacity-30"><ChevronUp size={16} /></button>
      <button disabled={i >= hits.length - 1} onClick={() => setI(i + 1)} aria-label="পরের ফলাফল" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 disabled:opacity-30"><ChevronDown size={16} /></button>
      <button onClick={onClose} aria-label="খোঁজা বন্ধ করুন" className="grid h-8 w-8 place-items-center rounded-full bg-surface2"><X size={16} /></button>
    </div>
  )
}
