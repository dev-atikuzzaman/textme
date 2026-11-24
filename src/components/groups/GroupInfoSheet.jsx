import { Globe, Lock, Camera, UserPlus, LogOut, Phone, Video, Pencil, X, Trash2 } from '../../lib/icons'
import { useAuth } from '../../context/Auth'
import Avatar from '../Avatar'
import { MAX_GROUP_CALL } from '../../context/GroupCall'

// গ্রুপ ইনফো শিট: কভার, ছবি, তথ্য, কলের বাটন, সদস্যদের ছোট তালিকা
export default function GroupInfoSheet({ g, gp, me, isAdmin, busy, members, who, fileRef, coverRef, setSheet, setCoverView, setCard, openPanel, onRemoveCover, onCall, onLeave, onDelete }) {
  const { user } = useAuth()
  return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={() => setSheet(null)}>
        <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]" onClick={(e) => e.stopPropagation()}>
          <div className="relative h-36 bg-gradient-to-br from-brand to-coral" onClick={() => (g.cover_url ? (setSheet(null), setCoverView(true)) : isAdmin && coverRef.current.click())}>
            {g.cover_url && <img src={g.cover_url} alt="গ্রুপের কভার ছবি" className="h-full w-full cursor-pointer object-cover" />}
            <button onClick={(e) => { e.stopPropagation(); setSheet(null) }} aria-label="বন্ধ" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white"><X size={18} /></button>
            {isAdmin && (
              <div className="absolute bottom-2 right-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                {g.cover_url && <button onClick={onRemoveCover} className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white">কভার মুছুন</button>}
                <button onClick={() => coverRef.current.click()} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white"><Camera size={14} />কভার ফটো</button>
              </div>
            )}
          </div>
          <div className="-mt-12 px-5 text-center">
            <button onClick={() => setSheet('photo')} className="relative mx-auto block rounded-full ring-4 ring-surface">
              <Avatar p={gp} size={96} />
              {isAdmin && <span onClick={(e) => { e.stopPropagation(); fileRef.current.click() }} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand text-inverse"><Camera size={15} /></span>}
            </button>
            <h2 className="mt-2 text-2xl font-bold">{g.name}</h2>
            <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-fg/65">{g.privacy === 'public' ? <Globe size={14} /> : <Lock size={14} />}{g.privacy === 'public' ? 'পাবলিক গ্রুপ' : 'প্রাইভেট গ্রুপ'} • {members.length.toLocaleString('bn-BD')} জন সদস্য</p>
            {g.about && <p className="mx-auto mt-3 max-w-sm text-sm text-fg/80">{g.about}</p>}
            {me && (
              <div className="mt-4 grid grid-cols-4 items-start gap-1">
                {[[Phone, 'অডিও কল', () => onCall('audio')], [Video, 'ভিডিও কল', () => onCall('video')], ...(isAdmin ? [[UserPlus, 'যোগ করুন', () => setSheet('add')], [Pencil, 'এডিট', () => setSheet('edit')]] : [])].map(([I, l, fn]) => (
                  <button key={l} onClick={() => { setSheet(null); fn() }} className="flex w-full flex-col items-center gap-1.5"><span className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand"><I size={21} /></span><span className="text-xs font-semibold">{l}</span></button>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-fg/65">গ্রুপ কলে সর্বোচ্চ {MAX_GROUP_CALL} জন একসাথে থাকতে পারেন</p>
          </div>
          <div className="mt-4 space-y-1 px-4">
            <p className="px-1 text-sm font-bold text-fg/65">সদস্য ({members.length.toLocaleString('bn-BD')})</p>
            {members.slice(0, 8).map((m) => { const p = who[m.user_id]; return (
              <button key={m.user_id} onClick={() => { setSheet(null); setCard(m.user_id) }} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface2"><Avatar p={p} size={40} /><span className="flex-1 truncate font-semibold">{p?.full_name}{m.user_id === user.id && ' (আপনি)'}</span>{m.role === 'admin' && <span className="text-xs font-bold text-brand">অ্যাডমিন</span>}</button>
            ) })}
            {members.length > 8 && <button onClick={() => { setSheet(null); openPanel('members') }} className="w-full py-2 text-sm font-bold text-brand">সবাইকে দেখুন</button>}
            {me && <button onClick={() => { setSheet(null); onLeave() }} className="btn-soft mt-2 w-full !text-danger"><LogOut size={17} />গ্রুপ ছাড়ুন</button>}
            {isAdmin && <button onClick={() => { setSheet(null); onDelete() }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 font-bold text-white active:scale-95"><Trash2 size={17} />গ্রুপ মুছে ফেলুন</button>}
          </div>
        </div>
      </div>
  
  )
}
