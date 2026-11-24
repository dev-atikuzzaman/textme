import { APP_NAME } from '../../lib/brand'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Link2, Share2, Send, Check } from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/Auth'
import { useFriends } from '../../lib/useFriends'
import { usePresence } from '../../context/Presence'
import Avatar from '../Avatar'

// WhatsApp/Viber-এর মতো: বন্ধুকে সরাসরি মেসেজে পোস্ট পাঠান, লিংক কপি, অন্য অ্যাপে শেয়ার
export default function ShareSheet({ url, text = '', onClose, onCopy, onNative }) {
  const { user } = useAuth()
  const { friends, people, other } = useFriends()
  const { isOnline } = usePresence()
  const [sent, setSent] = useState({})
  const [err, setErr] = useState('')

  const list = friends.map((r) => people[other(r)]).filter(Boolean)
    .sort((a, b) => isOnline(b.id) - isOnline(a.id))

  const send = async (p) => {
    setErr('')
    setSent((s) => ({ ...s, [p.id]: 'busy' }))
    const snippet = text.trim().slice(0, 80)
    const { error } = await supabase.from('messages').insert({ sender_id: user.id, receiver_id: p.id, content: `${snippet ? snippet + '\n' : ''}${url}` })
    if (error) { setSent((s) => ({ ...s, [p.id]: null })); return setErr('পাঠানো যায়নি') }
    setSent((s) => ({ ...s, [p.id]: 'done' }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">শেয়ার করুন</h3>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-surface2"><X size={18} /></button>
        </div>
        <div className="mb-3 flex gap-2">
          <button onClick={onCopy} className="btn-soft flex-1 !bg-surface2 !px-3 text-sm"><Link2 size={18} />লিংক কপি</button>
          {navigator.share && <button onClick={onNative} className="btn-soft flex-1 !bg-surface2 !px-3 text-sm"><Share2 size={18} />অন্য অ্যাপে</button>}
        </div>
        <p className="mb-2 px-1 text-sm font-bold text-fg/65">বন্ধুকে মেসেজে পাঠান</p>
        {list.length === 0 && <p className="py-6 text-center text-sm text-fg/65">এখনও কোনো বন্ধু নেই।</p>}
        <div className="space-y-1">
          {list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl p-2">
              <Avatar p={p} size={44} online={isOnline(p.id)} />
              <span className="min-w-0 flex-1 truncate font-bold">{p.full_name}</span>
              <button disabled={!!sent[p.id]} onClick={() => send(p)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${sent[p.id] === 'done' ? 'bg-success/20 text-success' : 'bg-gradient-to-r from-brand to-coral text-inverse disabled:opacity-60'}`}>
                {sent[p.id] === 'done' ? <><Check size={16} />পাঠানো হয়েছে</> : <><Send size={15} />পাঠান</>}
              </button>
            </div>
          ))}
        </div>
        {err && <p className="mt-2 rounded-xl bg-danger/15 p-2.5 text-center text-sm text-danger">{err}</p>}
      </div>
    </div>,
    document.body
  )
}
