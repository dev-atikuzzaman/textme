import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, CheckCheck, Check, UsersRound, Pin, Archive, ArchiveRestore, Lock, LockOpen, MoreVertical, ArrowLeft, PinOff } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useInbox } from '../context/Inbox'
import { usePresence } from '../context/Presence'
import { useFriends } from '../lib/useFriends'
import { useChatPrefs } from '../context/ChatPrefs'
import PinPad from '../components/chat/PinPad'
import Avatar from '../components/Avatar'
import CreateGroupSheet from '../components/groups/CreateGroupSheet'
import { toast } from '../lib/ui'

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
  const cp = useChatPrefs()
  const [filter, setFilter] = useState('all')   // all | unread | groups
  const [folder, setFolder] = useState(null)     // null | archived | locked
  const [menu, setMenu] = useState(null)         // চ্যাট অ্যাকশন শিট
  const [pad, setPad] = useState(null)           // {mode, then}
  const [folderOpen, setFolderOpen] = useState(false)
  const hold = useRef()

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
      let local = ''; try { local = localStorage.getItem('gread:' + g.id) || '' } catch { /* ignore */ }
      const rd = Math.max(Date.parse(gm.find((x) => x.group_id === g.id)?.last_read_at || 0) || 0, Date.parse(local) || 0)
      const mine = (ms || []).filter((m) => m.group_id === g.id)
      const last = mine[0]
      return { g, last, name: last && last.sender_id !== user.id ? nm[last.sender_id] : last ? 'আপনি' : '', unread: mine.filter((m) => m.sender_id !== user.id && Date.parse(m.created_at) > rd).length }
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
  const all = [
    ...friends.map((r) => people[r.requester_id === user.id ? r.addressee_id : r.requester_id]).filter((p) => p && match(p.full_name))
      .map((p) => ({ kind: 'dm', key: 'u:' + p.id, p, t: threads[p.id]?.last.created_at || '', unread: threads[p.id]?.unread || 0 })),
    ...groups.filter((x) => match(x.g.name)).map((x) => ({ kind: 'group', key: 'g:' + x.g.id, x, t: x.last?.created_at || '', unread: x.unread })),
  ]
  const byTime = (a, b) => b.t.localeCompare(a.t)
  const locked = all.filter((r) => cp.isLocked(r.key))
  const archived = all.filter((r) => !cp.isLocked(r.key) && cp.isArchived(r.key))
  const main = all.filter((r) => !cp.isLocked(r.key) && !cp.isArchived(r.key))
    .filter((r) => filter === 'all' || (filter === 'unread' ? r.unread > 0 : r.kind === 'group'))
  const rows = (folder === 'locked' ? locked : folder === 'archived' ? archived : main)
    .sort((a, b) => (cp.isPinned(b.key) - cp.isPinned(a.key)) || byTime(a, b))
  const unreadTotal = main.reduce((n, r) => n + (r.unread ? 1 : 0), 0)
  const archUnread = archived.reduce((n, r) => n + (r.unread ? 1 : 0), 0)
  const empty = friends.length === 0 && groups.length === 0

  const openLocked = () => {
    if (!cp.hasPin) return setPad({ mode: 'set', then: () => { setFolder('locked') } })
    if (folderOpen) return setFolder('locked')
    setPad({ mode: 'verify', then: () => { setFolderOpen(true); setFolder('locked') } })
  }
  const doLock = (key) => {
    const go = () => { cp.lock(key); cp.unlockSession(key) }
    if (!cp.hasPin) setPad({ mode: 'set', then: go }); else go()
  }
  const startHold = (r) => { clearTimeout(hold.current); hold.current = setTimeout(() => setMenu(r), 550) }
  const stopHold = () => clearTimeout(hold.current)

  const Chip = ({ id, label, n }) => (
    <button onClick={() => setFilter(id)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${filter === id ? 'bg-brand/25 text-brand ring-1 ring-brand/40' : 'bg-surface text-fg/70'}`}>{label}{n > 0 && <span className="ml-1 text-xs">{n.toLocaleString('bn-BD')}</span>}</button>
  )
  const Row = ({ r }) => {
    const pinned = cp.isPinned(r.key), lk = cp.isLocked(r.key)
    const common = { onTouchStart: () => startHold(r), onTouchEnd: stopHold, onTouchMove: stopHold, onContextMenu: (e) => { e.preventDefault(); setMenu(r) } }
    const unread = r.unread
    const Right = ({ time }) => (
      <div className="flex flex-col items-end gap-1">
        {time && <span className={`text-xs ${unread ? 'font-bold text-brand' : 'text-fg/45'}`}>{short(time)}</span>}
        <div className="flex items-center gap-1.5">{pinned && <Pin size={14} className="rotate-45 text-fg/45" />}<Badge n={unread} /></div>
      </div>
    )
    const More = () => <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenu(r) }} aria-label="অপশন" className="hidden h-8 w-8 shrink-0 place-items-center rounded-full text-fg/40 hover:bg-surface2 lg:grid"><MoreVertical size={17} /></button>
    if (r.kind === 'group') {
      const { g, last, name } = r.x
      return (
        <Link to={`/groups/${g.id}?tab=chat`} {...common} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft transition active:scale-[0.99]">
          <Avatar p={{ full_name: g.name, avatar_url: g.avatar_url }} size={52} />
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-1.5 truncate ${unread ? 'font-extrabold' : 'font-bold'}`}>{lk && <Lock size={13} className="shrink-0 text-brand" />}<span className="truncate">{g.name}</span></p>
            <p className={`truncate text-sm ${unread ? 'font-semibold text-fg' : 'text-fg/50'}`}>{lk ? '🔒 লক করা চ্যাট' : last ? `${name}: ${last.content ? last.content.split('\n')[0] : ({ video: '🎬 ভিডিও', audio: '🎵 অডিও', file: '📄 ফাইল' }[last.media_type] || '📷 ছবি')}` : 'গ্রুপ চ্যাট শুরু করুন'}</p>
          </div>
          <Right time={last?.created_at} /><More />
        </Link>
      )
    }
    const p = r.p, m = threads[p.id]?.last, mine = m?.sender_id === user.id
    return (
      <Link to={`/chat/${p.id}`} {...common} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft transition active:scale-[0.99]">
        <Avatar p={p} size={52} online={isOnline(p.id)} />
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-1.5 truncate ${unread ? 'font-extrabold' : 'font-bold'}`}>{lk && <Lock size={13} className="shrink-0 text-brand" />}<span className="truncate">{p.full_name}</span></p>
          <div className="flex items-center gap-1.5">
            {!lk && mine && (m.read_at ? <CheckCheck size={15} className="shrink-0 text-sky-400" /> : <Check size={15} className="shrink-0 text-fg/40" />)}
            <p className={`truncate text-sm ${unread ? 'font-semibold text-fg' : 'text-fg/50'}`}>{lk ? '🔒 লক করা চ্যাট' : m ? `${mine ? 'আপনি: ' : ''}${(m.content || '').split('\n')[0] || '📎 মিডিয়া'}` : 'মেসেজ পাঠাতে ট্যাপ করুন'}</p>
          </div>
        </div>
        <Right time={m?.created_at} /><More />
      </Link>
    )
  }
  const FolderRow = ({ icon: I, label, n, onClick, sub }) => (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-3xl px-4 py-3 text-left transition active:scale-[0.99]">
      <span className="grid h-10 w-10 place-items-center text-fg/60"><I size={22} /></span>
      <span className="flex-1"><span className="font-bold">{label}</span>{sub && <span className="block text-xs text-fg/45">{sub}</span>}</span>
      {n > 0 && <span className="text-sm font-bold text-brand">{n.toLocaleString('bn-BD')}</span>}
    </button>
  )

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        {folder ? (
          <div className="flex items-center gap-3"><button onClick={() => setFolder(null)} aria-label="পেছনে" className="grid h-10 w-10 place-items-center rounded-full bg-surface"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-extrabold">{folder === 'locked' ? 'লক করা চ্যাট' : 'আর্কাইভ করা চ্যাট'}</h2></div>
        ) : <h2 className="text-2xl font-extrabold">মেসেজ</h2>}
        {!folder && <button onClick={() => setCreate(true)} className="flex items-center gap-1.5 rounded-2xl bg-surface px-3.5 py-2.5 text-sm font-bold shadow-soft transition active:scale-95"><UsersRound size={18} className="text-brand" />নতুন গ্রুপ</button>}
      </div>
      {!empty && (
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
          <input className="input !pl-11" placeholder="বন্ধু বা গ্রুপ খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {!empty && !folder && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <Chip id="all" label="সব" /><Chip id="unread" label="অপঠিত" n={unreadTotal} /><Chip id="groups" label="গ্রুপ" />
        </div>
      )}
      {!empty && !folder && (<>
        {archived.length > 0 && <FolderRow icon={Archive} label="আর্কাইভ করা" n={archUnread} onClick={() => setFolder('archived')} />}
        <FolderRow icon={Lock} label="লক করা চ্যাট" n={0} sub={locked.length ? `${locked.length.toLocaleString('bn-BD')}টি চ্যাট` : 'চ্যাটে চেপে ধরে "লক করুন" দিন'} onClick={openLocked} />
      </>)}
      {empty && <p className="py-10 text-center text-fg/60">মেসেজ পাঠাতে আগে বন্ধু যোগ করুন (বন্ধু ট্যাব), অথবা একটি গ্রুপ খুলুন।</p>}
      {!empty && rows.length === 0 && <p className="py-8 text-center text-fg/50">{filter === 'unread' && !folder ? 'কোনো অপঠিত চ্যাট নেই।' : 'কিছু পাওয়া যায়নি।'}</p>}
      {rows.map((r) => <Row key={r.key} r={r} />)}
      {!empty && !folder && <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-fg/40"><Lock size={12} />চ্যাটে চেপে ধরলে (পিসিতে ডান-ক্লিক) পিন, আর্কাইভ ও লক অপশন আসবে</p>}

      {menu && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm" onClick={() => setMenu(null)}>
          <div className="w-full max-w-md space-y-1.5 rounded-t-[32px] bg-surface p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 pb-2 font-bold">{menu.kind === 'group' ? menu.x.g.name : menu.p.full_name}</p>
            {(() => {
              const k = menu.key, lk = cp.isLocked(k)
              const Item = ({ icon: I, label, onClick, danger }) => <button onClick={() => { setMenu(null); onClick() }} className={`flex w-full items-center gap-4 rounded-2xl bg-surface2 p-4 font-semibold ${danger ? 'text-danger' : ''}`}><I size={20} />{label}</button>
              return (<>
                {!lk && <Item icon={cp.isPinned(k) ? PinOff : Pin} label={cp.isPinned(k) ? 'পিন সরান' : 'চ্যাট পিন করুন'} onClick={() => { if (!cp.isPinned(k) && cp.pinnedCount >= 3) return toast('সর্বোচ্চ ৩টি চ্যাট পিন করা যায়'); cp.setPref(k, { pinned: !cp.isPinned(k) }) }} />}
                {!lk && <Item icon={cp.isArchived(k) ? ArchiveRestore : Archive} label={cp.isArchived(k) ? 'আর্কাইভ থেকে বের করুন' : 'আর্কাইভ করুন'} onClick={() => cp.setPref(k, { archived: !cp.isArchived(k) })} />}
                <Item icon={lk ? LockOpen : Lock} label={lk ? 'লক খুলুন' : 'চ্যাট লক করুন'} onClick={() => { if (lk) setPad({ mode: 'verify', then: () => cp.unlock(k) }); else doLock(k) }} />
              </>)
            })()}
          </div>
        </div>
      )}
      {pad && <PinPad mode={pad.mode} onClose={() => setPad(null)}
        onSubmit={async (p) => {
          if (pad.mode === 'set') { await cp.setPin(p); const f = pad.then; setPad(null); f(); return true }
          if (!(await cp.verify(p))) return false
          const f = pad.then; setPad(null); f(); return true
        }} />}
      {create && <CreateGroupSheet onClose={() => setCreate(false)} />}
    </div>
  )
}
