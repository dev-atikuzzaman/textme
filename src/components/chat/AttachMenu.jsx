import { Image, Film, Music, FileText, UserRound, BarChart3, X } from 'lucide-react'

const ITEMS = [
  { k: 'image', label: 'ছবি', Icon: Image, c: 'from-violet-500 to-fuchsia-500' },
  { k: 'video', label: 'ভিডিও', Icon: Film, c: 'from-rose-500 to-orange-400' },
  { k: 'audio', label: 'অডিও', Icon: Music, c: 'from-amber-400 to-orange-500' },
  { k: 'file', label: 'ডকুমেন্ট', Icon: FileText, c: 'from-sky-500 to-indigo-500' },
  { k: 'contact', label: 'কন্টাক্ট', Icon: UserRound, c: 'from-emerald-500 to-teal-500' },
  { k: 'poll', label: 'পোল', Icon: BarChart3, c: 'from-pink-500 to-purple-500' },
]

export default function AttachMenu({ onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[32px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">যা পাঠাতে চান</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {ITEMS.map(({ k, label, Icon, c }) => (
            <button key={k} onClick={() => onPick(k)} className="flex flex-col items-center gap-2">
              <span className={`grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-soft ${c}`}><Icon size={26} /></span>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink/50">ডকুমেন্ট: PDF, Word, PowerPoint, Excel • সর্বোচ্চ ৫০MB</p>
      </div>
    </div>
  )
}
