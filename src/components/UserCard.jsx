import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X, MessageCircle, Phone, Video, UserRound, BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useCall } from '../context/Call'
import { useRelation } from '../lib/useRelation'
import { usePresence } from '../context/Presence'
import Avatar from './Avatar'
import AvatarViewer from './AvatarViewer'
import PersonActions from './PersonActions'

// নামের উপর ক্লিক করলে আসা "কন্টাক্ট কার্ড" (হোয়াটসঅ্যাপ/ফেসবুকের মতো): ছবি, মেসেজ, কল, প্রোফাইল, ফ্রেন্ড/ব্লক অপশন
export default function UserCard({ userId, onClose }) {
  const { user } = useAuth()
  const { startCall } = useCall()
  const presence = usePresence?.()
  const nav = useNavigate()
  const [p, setP] = useState(null)
  const [view, setView] = useState(false)
  const rel = useRelation(userId)
  const me = userId === user.id

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,username,avatar_url,bio').eq('id', userId).maybeSingle().then(({ data }) => setP(data))
  }, [userId])
  const online = presence?.isOnline?.(userId)
  const friends = rel.state === 'friends'
  const Act = ({ icon: I, label, onClick, to, disabled }) => {
    const cls = `flex w-[4.5rem] flex-col items-center gap-1.5 ${disabled ? 'opacity-40' : ''}`
    const inner = <><span className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand transition active:scale-90"><I size={21} /></span><span className="text-xs font-semibold">{label}</span></>
    return to && !disabled ? <Link to={to} onClick={onClose} className={cls}>{inner}</Link> : <button disabled={disabled} onClick={onClick} className={cls}>{inner}</button>
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[32px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[32px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end"><button onClick={onClose} aria-label="বন্ধ" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button></div>
        {!p ? <p className="py-10 text-center text-fg/50">লোড হচ্ছে…</p> : (<>
          <div className="text-center">
            <button onClick={() => p.avatar_url && setView(true)} className="relative mx-auto block rounded-full transition active:scale-95"><Avatar p={p} size={96} online={online} /></button>
            <h2 className="mt-3 text-xl font-bold">{p.full_name}</h2>
            <p className="text-sm text-fg/55">@{p.username}{online ? ' • অনলাইন' : ''}</p>
            {p.bio && <p className="mx-auto mt-2 max-w-xs text-sm text-fg/75">{p.bio}</p>}
          </div>
          {!me && (
            <div className="mt-4 flex items-start justify-center gap-3">
              <Act icon={MessageCircle} label="মেসেজ" to={`/chat/${p.id}`} disabled={!friends} />
              <Act icon={Phone} label="অডিও কল" onClick={() => { onClose(); startCall(p, 'audio') }} disabled={!friends} />
              <Act icon={Video} label="ভিডিও কল" onClick={() => { onClose(); startCall(p, 'video') }} disabled={!friends} />
              <Act icon={UserRound} label="প্রোফাইল" to={`/profile/${p.id}`} />
            </div>
          )}
          {!me && !friends && <p className="mt-3 text-center text-xs text-fg/55">মেসেজ ও কল করতে আগে বন্ধু হতে হবে।</p>}
          <div className="mt-4 flex justify-center">{me ? <Link to="/profile" onClick={onClose} className="btn-soft">আমার প্রোফাইল</Link> : <PersonActions p={p} onChange={rel.reload} />}</div>
        </>)}
        {view && p?.avatar_url && <AvatarViewer p={p} onClose={() => setView(false)} />}
      </div>
    </div>
  )
}
