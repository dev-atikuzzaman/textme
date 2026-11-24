import { Send, Plus, Mic, Trash2 } from '../../lib/icons'
import { mmss } from '../../lib/media'

// নিচের বার: লেখার ফর্ম, অথবা রেকর্ডিং চললে রেকর্ডিং-বার
export default function Composer({ rec, text, onText, onSubmit, onAttach, onStartRec, onStopRec }) {
  const pad = 'bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
  if (rec) {
    return (
      <div className={`flex items-center gap-3 ${pad}`}>
        <button onClick={() => onStopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-danger" aria-label="মুছুন"><Trash2 size={20} /></button>
        <span className="h-3 w-3 animate-pulse rounded-full bg-danger/150" />
        <span className="flex-1 font-semibold tabular-nums">রেকর্ড হচ্ছে… {mmss(rec.secs)}</span>
        <button onClick={() => onStopRec(true)} className="btn-primary !px-4" aria-label="পাঠান"><Send size={20} /></button>
      </div>
    )
  }
  return (
    <form onSubmit={onSubmit} className={`flex items-center gap-2 ${pad}`}>
      <button type="button" onClick={onAttach} aria-label="যুক্ত করুন" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 text-brand"><Plus size={22} /></button>
      <input className="input" placeholder="মেসেজ লিখুন…" value={text} onChange={(e) => onText(e.target.value)} />
      {text.trim()
        ? <button aria-label="পাঠান" className="btn-primary !px-4"><Send size={20} /></button>
        : <button type="button" onClick={onStartRec} aria-label="ভয়েস মেসেজ রেকর্ড করুন" className="btn-primary !px-4"><Mic size={20} /></button>}
    </form>
  )
}
