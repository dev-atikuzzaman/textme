import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, CheckCheck, Check, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useInbox } from '../context/Inbox'
import { usePresence } from '../context/Presence'
import { useFriends } from '../lib/useFriends'
import Avatar from '../components/Avatar'
import CreateGroupSheet from '../components/groups/CreateGroupSheet'

const short = (d) => {
  const t = new Date(d), n = new Date()
  return t.toDateString() === n.toDateString()
    ? t.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    : t.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}
const Badge = ({ n }) => n > 0 && <span className="ml-auto grid min-w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-coral px-1.5 text-xs font-bold leading-6 text-inverse">{n > 99 ? '99+' : n.toLocaleString('bn-BD')}</span>

export default function Messages() {
  const { user } = useAuth()
  const { friends, people, other } = useFriends()
  const { threads } = useInbox()
  const { isOnline } = usePresence()
  const [q, setQ] = useState('')
  const [groups, setGroups] = useState([])
  const [create, setCreate] = useState(false)

  // গ্রুপ চ্যাট (WhatsApp-এর মতো একই ইনবক্সে): শেষ মেসেজ ও আনরিড
  const loadGroups = useCallback(async () => {
    const { data: gm, error } = await supabase.from('group_members').select('group_id,last_read_at').eq('user_id', user.id)
    if (error || !gm?.length) return setGroups([])
    const ids = gm.map((x) => x.group_id)
    const [{ data: gs }, { data: ms }] = await Promise.all([
      supabase.from('groups').select('id,name,avatar_url').in('id', ids),
      supabase.from('group_messages').select('id,group_id,sender_id,content,media_type,created_at').in('group_id', ids).order('created_at', { ascending: false }).limit(300),
    ])
    const senders = [...new Set((ms || []).map((m) => m.sender_id))].filter((i) => i !== user.id)
    const { data: ps } = senders.length ? await supabase.from('profiles').select('id,full_name').in('id', senders) : { data: [] }
    const nm = Object.fromEntries((ps || []).map((p) => [p.id, p.full_name.split(' ')[0]]))
    setGroups((gs || []).map((g) => {
      const read = gm.find((x) => x.group_id === g.id)?.last_read_at || ''
      const mine = (ms || []).filter((m) => m.group_id === g.id)
      const last = mine[0]
      return { g, last, name: last && last.sender_id !== user.id ? nm[last.sender_id] : last ? 'আপনি' : '', unread: mine.filter((m) => m.sender_id !== user.id && m.created_at > read).length }
    }))
  }, [user.id])
  useEffect(() => {
    loadGroups()
    const ch = supabase.channel(`gmsgs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => loadGroups())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user.id, loadGroups])

  const match = (s) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase())
  const rows = [
    ...friends.map((r) => people[r.requester_id === user.id ? r.addressee_id : r.requester_id]).filter((p) => p && match(p.full_name))
      .map((p) => ({ kind: 'dm', key: p.id, p, t: threads[p.id]?.last.created_at || '' })),
    ...groups.filter((x) => match(x.g.name)).map((x) => ({ kind: 'group', key: 'g' + x.g.id, x, t: x.last?.created_at || '' })),
  ].sort((a, b) => b.t.localeCompare(a.t))
  const empty = friends.length === 0 && groups.length === 0

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">মেসেজ</h2>
        <button onClick={() => setCreate(true)} className="flex items-center gap-1.5 rounded-2xl bg-surface px-3.5 py-2.5 text-sm font-bold shadow-soft transition active:scale-95"><UsersRound size={18} className="text-brand" />নতুন গ্রুপ</button>
      </div>
      {!empty && (
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
          <input className="input !pl-11" placeholder="বন্ধু বা গ্রুপ খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {empty && <p className="py-10 text-center text-fg/60">মেসেজ পাঠাতে আগে বন্ধু যোগ করুন (বন্ধু ট্যাব), অথবা একটি গ্রুপ খুলুন।</p>}
      {!empty && rows.length === 0 && <p className="py-8 text-center text-fg/50">কাউকে পাওয়া যায়নি।</p>}

      {rows.map((r) => {
        if (r.kind === 'group') {
          const { g, last, name, unread } = r.x
          return (
            <Link key={r.key} to={`/groups/${g.id}?tab=chat`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft transition active:scale-[0.99]">
              <Avatar p={{ full_name: g.name, avatar_url: g.avatar_url }} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`flex items-center gap-1.5 truncate ${unread ? 'font-extrabold' : 'font-bold'}`}><UsersRound size={14} className="shrink-0 text-brand" /><span className="truncate">{g.name}</span></p>
                  {last && <span className={`shrink-0 text-xs ${unread ? 'font-bold text-brand' : 'text-fg/45'}`}>{short(last.created_at)}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className={`truncate text-sm ${unread ? 'font-semibold text-fg' : 'text-fg/50'}`}>{last ? `${name}: ${last.content ? last.content.split('\n')[0] : '📷 ছবি'}` : 'গ্রুপ চ্যাট শুরু করুন'}</p>
                  <Badge n={unread} />
                </div>
              </div>
            </Link>
          )
        }
        const p = r.p, t = threads[p.id], m = t?.last, mine = m?.sender_id === user.id, unread = t?.unread || 0
        return (
          <Link key={r.key} to={`/chat/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft transition active:scale-[0.99]">
            <Avatar p={p} size={52} online={isOnline(p.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`truncate ${unread ? 'font-extrabold' : 'font-bold'}`}>{p.full_name}</p>
                {m && <span className={`shrink-0 text-xs ${unread ? 'font-bold text-brand' : 'text-fg/45'}`}>{short(m.created_at)}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {mine && (m.read_at ? <CheckCheck size={15} className="shrink-0 text-sky-400" /> : <Check size={15} className="shrink-0 text-fg/40" />)}
                <p className={`truncate text-sm ${unread ? 'font-semibold text-fg' : 'text-fg/50'}`}>{m ? `${mine ? 'আপনি: ' : ''}${m.content.split('\n')[0]}` : 'মেসেজ পাঠাতে ট্যাপ করুন'}</p>
                <Badge n={unread} />
              </div>
            </div>
          </Link>
        )
      })}
      {create && <CreateGroupSheet onClose={() => setCreate(false)} />}
    </div>
  )
}
