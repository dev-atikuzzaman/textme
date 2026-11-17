import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Check, X, MessageCircle, UsersRound, Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useFriends } from '../lib/useFriends'
import Avatar from '../components/Avatar'
import PersonActions, { UnfriendDialog } from '../components/PersonActions'

const Row = ({ p, children }) => (
  <div className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft">
    <Link to={`/profile/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl transition active:scale-[0.99]">
      <Avatar p={p} />
      <div className="min-w-0 flex-1"><p className="truncate font-bold">{p.full_name}</p><p className="truncate text-xs text-fg/50">@{p.username}</p></div>
    </Link>
    {children}
  </div>
)

export default function Friends() {
  const { user } = useAuth()
  const { rels, people, reload, other, friends, incoming } = useFriends()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [unf, setUnf] = useState(null)

  const search = async (e) => {
    e.preventDefault()
    const t = q.replace(/[,()%*\\]/g, '').trim()
    if (!t) return setResults(null)
    const { data } = await supabase.rpc('search_people', { q: t })
    setResults(data || [])
  }
  const accept = async (id) => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id); reload() }
  const remove = async (id) => { await supabase.from('friendships').delete().eq('id', id); reload() }

  return (
    <div className="space-y-5 pt-2">
      <form onSubmit={search} className="relative">
        <Search className="absolute left-4 top-3.5 text-fg/40" size={20} />
        <input className="input !pl-12" placeholder="নাম, ইউজারনেম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/groups" className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-soft transition active:scale-95"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-coral text-inverse"><UsersRound size={22} /></span><span className="font-bold">গ্রুপ</span></Link>
        <Link to="/groups?tab=pages" className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-soft transition active:scale-95"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-coral text-inverse"><Flag size={22} /></span><span className="font-bold">পেজ</span></Link>
      </div>
      {results && (
        <section className="space-y-2">
          <h3 className="font-bold">সার্চ ফলাফল</h3>
          {results.length === 0 && <p className="text-fg/60">কাউকে পাওয়া যায়নি।</p>}
          {results.map((p) => (
            <div key={p.id} className="rounded-3xl bg-surface p-3 shadow-soft">
              <Link to={`/profile/${p.id}`} className="flex items-center gap-3"><Avatar p={p} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.full_name}</p><p className="truncate text-xs text-fg/50">@{p.username}</p></div>
                {p.matched !== 'name' && <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">{p.matched === 'email' ? 'ইমেইল মিলেছে' : 'ফোন মিলেছে'}</span>}</Link>
              <div className="mt-3"><PersonActions p={p} onChange={reload} /></div>
            </div>
          ))}
        </section>
      )}
      {incoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold">ফ্রেন্ড রিকুয়েস্ট ({incoming.length})</h3>
          {incoming.map((r) => people[r.requester_id] && (
            <Row key={r.id} p={people[r.requester_id]}>
              <button onClick={() => accept(r.id)} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-inverse"><Check size={18} /></button>
              <button onClick={() => remove(r.id)} className="grid h-10 w-10 place-items-center rounded-full bg-surface2"><X size={18} /></button>
            </Row>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h3 className="font-bold">বন্ধু ও আত্মীয় ({friends.length})</h3>
        {friends.length === 0 && <p className="text-fg/60">ওপরে নাম লিখে খুঁজে পরিবারের সদস্যদের যোগ করুন।</p>}
        {friends.map((r) => people[other(r)] && (
          <Row key={r.id} p={people[other(r)]}>
            <Link to={`/chat/${other(r)}`} className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-brand"><MessageCircle size={18} /></Link>
            <button aria-label="আনফ্রেন্ড" onClick={() => setUnf({ id: r.id, name: people[other(r)].full_name })} className="grid h-10 w-10 place-items-center rounded-full bg-surface2 text-fg/50"><X size={18} /></button>
          </Row>
        ))}
      </section>
      {unf && <UnfriendDialog name={unf.name} onClose={() => setUnf(null)} onConfirm={() => { remove(unf.id); setUnf(null) }} />}
    </div>
  )
}
