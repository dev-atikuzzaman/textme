import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifs, NOTIF_TEXT } from '../context/Notifications'
import { fmt } from '../lib/constants'
import Avatar from '../components/Avatar'

const target = (n) => (n.post_id ? `/post/${n.post_id}` : n.type === 'friend_request' ? '/friends' : `/profile/${n.actor_id}`)

export default function Notifications() {
  const { items, markAllRead } = useNotifs()
  const [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'unsupported')
  useEffect(() => () => { markAllRead() }, [markAllRead])

  const ask = async () => setPerm(await Notification.requestPermission())

  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-2xl font-extrabold">নোটিফিকেশন</h2>
      {perm === 'default' && (
        <button onClick={ask} className="flex w-full items-center gap-3 rounded-3xl bg-ink p-4 text-left text-white">
          <Bell size={22} /><span className="flex-1 text-sm">অ্যাপ ব্যাকগ্রাউন্ডে থাকলেও জানাতে অ্যালার্ট চালু করুন</span>
          <span className="rounded-2xl bg-white px-3 py-1.5 text-sm font-bold text-ink">চালু</span>
        </button>
      )}
      {items.length === 0 && <p className="py-10 text-center text-ink/60">এখনও কোনো নোটিফিকেশন নেই।</p>}
      {items.map((n) => (
        <Link key={n.id} to={target(n)} className={`flex items-center gap-3 rounded-3xl p-3 shadow-soft ${n.read ? 'bg-white' : 'bg-white ring-2 ring-brand/40'}`}>
          <Avatar p={n.actor} size={48} />
          <div className="min-w-0 flex-1">
            <p className="leading-snug"><b>{n.actor?.full_name}</b> {NOTIF_TEXT[n.type]}</p>
            <p className="text-xs text-ink/50">{fmt(n.created_at)}</p>
          </div>
          {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-coral" />}
        </Link>
      ))}
    </div>
  )
}
