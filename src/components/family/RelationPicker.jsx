import { X } from 'lucide-react'
import { RELATIONS, GENERATIONS } from '../../lib/family'
import Avatar from '../Avatar'

// "ওকে আপনি কী বলে ডাকেন?" — সম্পর্ক বেছে নিন (শুধু আপনার নিজের জন্য, অন্যজন জানতে পারে না)
export default function RelationPicker({ person, current, onPick, onClose }) {
  const groups = [...GENERATIONS.map((g) => ({ title: g.title, items: RELATIONS.filter((r) => r.gen === g.gen) })), { title: 'অন্যান্য', items: RELATIONS.filter((r) => r.gen === null) }]
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="সম্পর্ক বেছে নিন"
        className="pop-in max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Avatar p={person} size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{person?.full_name}</h2>
            <p className="text-sm text-fg/60">আপনি ওকে কী বলে ডাকেন?</p>
          </div>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        {groups.map((g) => (
          <section key={g.title}>
            <p className="mb-1.5 text-sm font-bold text-fg/60">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((r) => (
                <button key={r.id} onClick={() => onPick(r.id)} aria-pressed={current === r.id}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${current === r.id ? 'bg-brand text-inverse' : 'bg-surface2'}`}>{r.label}</button>
              ))}
            </div>
          </section>
        ))}
        {current && <button onClick={() => onPick(null)} className="btn-soft w-full !text-danger">সম্পর্কের ট্যাগ সরান</button>}
        <p className="text-xs text-fg/55">এই ট্যাগ শুধু আপনিই দেখতে পাবেন। ফ্যামিলি ট্রি এর ওপর ভিত্তি করে সাজানো হয়।</p>
      </div>
    </div>
  )
}
