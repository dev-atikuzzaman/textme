import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Check, X, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useFriends } from '../lib/useFriends'
import Avatar from '../components/Avatar'

const Row = ({ p, children }) => (
  <div className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-soft">
    <Link to={`/profile/${p.id}`}><Avatar p={p} /></Link>
    <div className="min-w-0 flex-1"><p className="truncate font-bold">{p.full_name}</p><p className="truncate text-xs text-ink/50">@{p.username}</p></div>
    {children}
  </div>
)

export default function Friends() {
  const { user } = useAuth()
  const { rels, people, reload, other, friends, incoming } = useFriends()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)

  const search = async (e) => {
    e.preventDefault()
    const t = q.replace(/[,()%*]/g, '').trim()
    if (!t) return setResults(null)
    const { data } = await supabase.from('profiles').select('*')
      .or(`username.ilike.%${t}%,full_name.ilike.%${t}%`).neq('id', user.id).limit(20)
    setResults(data || [])
  }
  const send = async (id) => { await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: id }); reload() }
  const accept = async (id) => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id); reload() }
  const remove = async (id) => { await supabase.from('friendships').delete().eq('id', id); reload() }

  const action = (p) => {
    const r = rels.find((x) => other(x) === p.id)
    if (!r) return <button onClick={() => send(p.id)} className="btn-primary !px-4 !py-2"><UserPlus size={16} />যোগ করুন</button>
    if (r.status === 'accepted') return <span className="text-sm font-semibold text-brand">বন্ধু</span>
    if (r.addressee_id === user.id) return <button onClick={() => accept(r.id)} className="btn-primary !px-4 !py-2">গ্রহণ</button>
    return <span className="text-sm text-ink/50">পাঠানো হয়েছে</span>
  }

  return (
    <div className="space-y-5 pt-2">
      <form onSubmit={search} className="relative">
        <Search className="absolute left-4 top-3.5 text-ink/40" size={20} />
        <input className="input !pl-12" placeholder="নাম বা ইউজারনেম দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {results && (
        <section className="space-y-2">
          <h3 className="font-bold">সার্চ ফলাফল</h3>
          {results.length === 0 && <p className="text-ink/60">কাউকে পাওয়া যায়নি।</p>}
          {results.map((p) => <Row key={p.id} p={p}>{action(p)}</Row>)}
        </section>
      )}
      {incoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold">ফ্রেন্ড রিকুয়েস্ট ({incoming.length})</h3>
          {incoming.map((r) => people[r.requester_id] && (
            <Row key={r.id} p={people[r.requester_id]}>
              <button onClick={() => accept(r.id)} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white"><Check size={18} /></button>
              <button onClick={() => remove(r.id)} className="grid h-10 w-10 place-items-center rounded-full bg-mist"><X size={18} /></button>
            </Row>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h3 className="font-bold">বন্ধু ও আত্মীয় ({friends.length})</h3>
        {friends.length === 0 && <p className="text-ink/60">ওপরে নাম লিখে খুঁজে পরিবারের সদস্যদের যোগ করুন।</p>}
        {friends.map((r) => people[other(r)] && (
          <Row key={r.id} p={people[other(r)]}>
            <Link to={`/chat/${other(r)}`} className="grid h-10 w-10 place-items-center rounded-full bg-mist text-brand"><MessageCircle size={18} /></Link>
            <button onClick={() => confirm('বন্ধুত্ব শেষ করবেন?') && remove(r.id)} className="grid h-10 w-10 place-items-center rounded-full bg-mist text-ink/50"><X size={18} /></button>
          </Row>
        ))}
      </section>
    </div>
  )
}
