import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, UserCheck, UserX, Hand, Ban, Archive, ArchiveRestore, MoreVertical, MessageCircle, X, ShieldOff } from '../lib/icons'
import { useRelation } from '../lib/useRelation'
import { useChatPrefs } from '../context/ChatPrefs'
import { confirmDialog } from '../lib/ui'

// ফেসবুকের মতো আনফ্রেন্ড কনফার্ম পপ-আপ
export function UnfriendDialog({ name, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-ink/55 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in w-full max-w-xs rounded-[28px] bg-surface p-5 text-center shadow-soft" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger"><UserX size={26} /></span>
        <h3 className="mt-3 text-lg font-bold">আনফ্রেন্ড করবেন কি?</h3>
        <p className="mt-1 text-sm text-fg/65"><b>{name}</b>-এর সাথে বন্ধুত্ব শেষ করতে চান? "না" দিলে আগের মতোই থাকবে।</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-slate-200 py-3 text-base font-bold text-slate-800 active:scale-95">না</button>
          <button onClick={onConfirm} className="flex-1 rounded-2xl bg-red-600 py-3 text-base font-bold text-white active:scale-95">হ্যাঁ</button>
        </div>
      </div>
    </div>
  )
}

// একজন মানুষের জন্য সব অ্যাকশন: ফ্রেন্ড রিকুয়েস্ট / বাতিল / গ্রহণ, পোক, ব্লক, আর্কাইভ
export default function PersonActions({ p, size = 'sm', onChange }) {
  const r = useRelation(p.id)
  const cp = useChatPrefs()
  const [menu, setMenu] = useState(false)
  const [unf, setUnf] = useState(false)
  const key = 'u:' + p.id
  const after = (f) => async () => { const ok = await f(); if (ok !== false) onChange?.() }
  const pad = size === 'lg' ? '!px-5 !py-3' : '!px-3.5 !py-2 text-sm'
  const Primary = {
    none: <button disabled={r.busy} onClick={after(r.send)} className={`btn-primary ${pad}`}><UserPlus size={17} />বন্ধু যোগ করুন</button>,
    sent: <button disabled={r.busy} onClick={after(r.cancel)} className={`btn-soft ring-1 ring-fg/15 ${pad}`}><UserX size={17} />রিকুয়েস্ট বাতিল</button>,
    incoming: (<>
      <button disabled={r.busy} onClick={after(r.accept)} className={`btn-primary ${pad}`}><UserCheck size={17} />গ্রহণ করুন</button>
      <button disabled={r.busy} onClick={after(r.cancel)} className={`btn-soft ${pad}`}>মুছুন</button>
    </>),
    friends: (<>
      <button onClick={() => setUnf(true)} className={`btn-soft text-brand ${pad}`}><UserCheck size={17} />বন্ধু</button>
      <Link to={`/chat/${p.id}`} className={`btn-primary ${pad}`}><MessageCircle size={17} />মেসেজ</Link>
    </>),
    blocked: <button disabled={r.busy} onClick={after(r.unblock)} className={`btn-soft ring-1 ring-danger/30 !text-danger ${pad}`}><ShieldOff size={17} />আনব্লক</button>,
  }[r.state]

  const Item = ({ icon: I, label, onClick, danger }) => (
    <button onClick={() => { setMenu(false); onClick() }} className={`flex w-full items-center gap-4 rounded-2xl bg-surface2 p-4 font-semibold ${danger ? 'text-danger' : ''}`}><I size={20} />{label}</button>
  )
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {Primary}
        <button onClick={() => setMenu(true)} aria-label="আরও অপশন" className="grid h-10 w-10 place-items-center rounded-full bg-surface2"><MoreVertical size={19} /></button>
      </div>
      {unf && <UnfriendDialog name={p.full_name} onClose={() => setUnf(false)} onConfirm={() => { setUnf(false); after(r.cancel)() }} />}
      {menu && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={() => setMenu(false)}>
          <div className="w-full max-w-md space-y-2 rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between"><h2 className="truncate text-lg font-bold">{p.full_name}</h2><button onClick={() => setMenu(false)} className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button></div>
            {r.state !== 'blocked' && <Item icon={Hand} label="পোক করুন 👉" onClick={r.poke} />}
            <Item icon={cp.isArchived(key) ? ArchiveRestore : Archive} label={cp.isArchived(key) ? 'আর্কাইভ থেকে বের করুন' : 'আর্কাইভ করুন (চ্যাট লুকান)'} onClick={() => cp.setPref(key, { archived: !cp.isArchived(key) })} />
            {r.state === 'friends' && <Item icon={UserX} label="বন্ধুত্ব শেষ করুন" onClick={() => setUnf(true)} danger />}
            {r.state === 'blocked'
              ? <Item icon={ShieldOff} label="আনব্লক করুন" onClick={after(r.unblock)} />
              : <Item icon={Ban} label="ব্লক করুন" onClick={async () => (await confirmDialog(`${p.full_name}-কে ব্লক করবেন? বন্ধুত্ব শেষ হবে, সে আপনাকে মেসেজ বা রিকুয়েস্ট পাঠাতে পারবে না।`, { danger: true, confirmText: 'ব্লক করুন' })) && after(r.block)()} danger />}
          </div>
        </div>
      )}
    </>
  )
}
