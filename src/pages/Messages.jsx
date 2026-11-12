import { Link } from 'react-router-dom'
import { useFriends } from '../lib/useFriends'
import Avatar from '../components/Avatar'

export default function Messages() {
  const { friends, people, other } = useFriends()
  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-2xl font-extrabold">মেসেজ</h2>
      {friends.length === 0 && <p className="py-10 text-center text-ink/60">মেসেজ পাঠাতে আগে বন্ধু যোগ করুন (বন্ধু ট্যাব)।</p>}
      {friends.map((r) => {
        const p = people[other(r)]
        return p && (
          <Link key={r.id} to={`/chat/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-soft">
            <Avatar p={p} size={52} />
            <div><p className="font-bold">{p.full_name}</p><p className="text-sm text-ink/50">মেসেজ পাঠাতে ট্যাপ করুন</p></div>
          </Link>
        )
      })}
    </div>
  )
}
