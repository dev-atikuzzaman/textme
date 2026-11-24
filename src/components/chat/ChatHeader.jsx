import { ArrowLeft, Phone, Video, MoreVertical } from '../../lib/icons'
import Avatar from '../Avatar'

export default function ChatHeader({ other, online, typing, inCall, onBack, onCard, onCall, onTools }) {
  return (
    <header className="flex items-center gap-3 bg-surface p-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm">
      <button onClick={onBack} aria-label="পেছনে যান" className="grid h-10 w-10 place-items-center rounded-full bg-surface2"><ArrowLeft size={20} /></button>
      <button onClick={onCard} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar p={other} size={40} online={online} />
        <div className="min-w-0 flex-1 leading-tight"><b className="block truncate">{other?.full_name}</b><span className="text-xs text-brand">{typing ? 'লিখছে…' : online ? 'অনলাইন' : ''}</span></div>
      </button>
      <button disabled={inCall || !other} onClick={() => onCall('audio')} aria-label="অডিও কল" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-brand disabled:opacity-40"><Phone size={19} /></button>
      <button disabled={inCall || !other} onClick={() => onCall('video')} aria-label="ভিডিও কল" className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-brand disabled:opacity-40"><Video size={19} /></button>
      <button onClick={onTools} aria-label="চ্যাট টুলস" className="grid h-10 w-10 place-items-center rounded-full bg-surface2"><MoreVertical size={19} /></button>
    </header>
  )
}
