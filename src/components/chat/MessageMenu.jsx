import { Copy, Pin, PinOff } from 'lucide-react'

// মেসেজ চেপে ধরলে নিচ থেকে ওঠা মেনু: কপি, পিন/আনপিন
export default function MessageMenu({ m, onClose, onCopy, onPin }) {
  const text = m.content && !['image', 'video', 'audio', 'voice', 'file', 'contact', 'poll', 'call'].includes(m.type) ? m.content : ''
  const Item = ({ Icon, label, onClick }) => (
    <button onClick={() => { onClose(); onClick() }} className="flex w-full items-center gap-4 rounded-2xl bg-surface2 p-4 font-semibold active:scale-[0.99]"><Icon size={20} />{label}</button>
  )
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="pop-in w-full max-w-md space-y-2 rounded-t-[32px] bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-fg/15" />
        {m.content && <p className="line-clamp-2 rounded-2xl bg-surface2/60 px-3 py-2 text-sm text-fg/65">{m.content}</p>}
        {text && <Item Icon={Copy} label="কপি করুন" onClick={() => onCopy(text)} />}
        <Item Icon={m.pinned_at ? PinOff : Pin} label={m.pinned_at ? 'পিন সরান' : 'চ্যাটের ওপরে পিন করুন'} onClick={() => onPin(m)} />
        <button onClick={onClose} className="btn-soft w-full">বন্ধ করুন</button>
      </div>
    </div>
  )
}
