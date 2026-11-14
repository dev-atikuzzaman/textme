import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, CheckCheck, Check } from 'lucide-react'
import { useAuth } from '../context/Auth'
import { useInbox } from '../context/Inbox'
import { usePresence } from '../context/Presence'
import { useFriends } from '../lib/useFriends'
import Avatar from '../components/Avatar'

const short = (d) => {
  const t = new Date(d), n = new Date()
  return t.toDateString() === n.toDateString()
    ? t.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    : t.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

export default function Messages() {
  const { user } = useAuth()
  const { friends, people, other } = useFriends()
  const { threads } = useInbox()
  const { isOnline } = usePresence()
  const [q, setQ] = useState('')

  const rows = friends.map((r) => people[other(r)]).filter(Boolean)
    .filter((p) => !q.trim() || p.full_name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (threads[b.id]?.last.created_at || '').localeCompare(threads[a.id]?.last.created_at || ''))

  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-2xl font-extrabold">মেসেজ</h2>
      {friends.length > 0 && (
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
          <input className="input !pl-11" placeholder="বন্ধু খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {friends.length === 0 && <p className="py-10 text-center text-fg/60">মেসেজ পাঠাতে আগে বন্ধু যোগ করুন (বন্ধু ট্যাব)।</p>}
      {friends.length > 0 && rows.length === 0 && <p className="py-8 text-center text-fg/50">কাউকে পাওয়া যায়নি।</p>}
      {rows.map((p) => {
        const t = threads[p.id]
        const m = t?.last
        const mine = m?.sender_id === user.id
        const unread = t?.unread || 0
        return (
          <Link key={p.id} to={`/chat/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft transition active:scale-[0.99]">
            <Avatar p={p} size={52} online={isOnline(p.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`truncate ${unread ? 'font-extrabold' : 'font-bold'}`}>{p.full_name}</p>
                {m && <span className={`shrink-0 text-xs ${unread ? 'font-bold text-brand' : 'text-fg/45'}`}>{short(m.created_at)}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {mine && (m.read_at ? <CheckCheck size={15} className="shrink-0 text-sky-400" /> : <Check size={15} className="shrink-0 text-fg/40" />)}
                <p className={`truncate text-sm ${unread ? 'font-semibold text-fg' : 'text-fg/50'}`}>
                  {m ? `${mine ? 'আপনি: ' : ''}${m.content.split('\n')[0]}` : 'মেসেজ পাঠাতে ট্যাপ করুন'}
                </p>
                {unread > 0 && <span className="ml-auto grid min-w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-coral px-1.5 text-xs font-bold leading-6 text-inverse">{unread > 99 ? '99+' : unread.toLocaleString('bn-BD')}</span>}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
