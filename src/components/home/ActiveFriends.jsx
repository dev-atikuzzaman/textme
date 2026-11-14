import { Link } from 'react-router-dom'
import { useFriends } from '../../lib/useFriends'
import { usePresence } from '../../context/Presence'
import Avatar from '../Avatar'

// Messenger-এর মতো "এখন অনলাইন" বন্ধুদের সারি
export default function ActiveFriends() {
  const { friends, people, other } = useFriends()
  const { isOnline } = usePresence()
  const list = friends.map((r) => people[other(r)]).filter((p) => p && isOnline(p.id))
  if (!list.length) return null
  return (
    <section className="rounded-[28px] bg-surface p-4 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-fg/70"><span className="h-2.5 w-2.5 rounded-full bg-success" />এখন অনলাইন ({list.length.toLocaleString('bn-BD')})</h2>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1">
        {list.map((p) => (
          <Link key={p.id} to={`/chat/${p.id}`} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
            <Avatar p={p} size={52} online />
            <span className="w-full truncate text-center text-xs text-fg/70">{p.full_name.split(' ')[0]}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
