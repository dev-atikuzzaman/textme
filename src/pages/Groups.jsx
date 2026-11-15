import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Search, Lock, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import Avatar from '../components/Avatar'
import CreateGroupSheet from '../components/groups/CreateGroupSheet'
import PageSheet from '../components/groups/PageSheet'

const TABS = [['mine', 'আমার গ্রুপ'], ['discover', 'আবিষ্কার'], ['pages', 'পেজ']]

const Row = ({ to, p, title, sub, right }) => (
  <Link to={to} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft transition active:scale-[0.99]">
    <Avatar p={p} size={52} />
    <div className="min-w-0 flex-1"><p className="truncate font-bold">{title}</p><p className="truncate text-sm text-fg/55">{sub}</p></div>
    {right}
  </Link>
)

export default function Groups() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(([t]) => t === sp.get('tab')) ? sp.get('tab') : 'mine'
  const [mine, setMine] = useState(null)
  const [pub, setPub] = useState(null)
  const [pages, setPages] = useState(null)
  const [following, setFollowing] = useState(new Set())
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const { data: gm, error } = await supabase.from('group_members').select('group_id').eq('user_id', user.id)
    if (error) { setErr(/relation|schema cache|does not exist/i.test(error.message) ? 'update-14.sql চালানো হয়নি — Supabase SQL Editor-এ চালান।' : error.message); setMine([]); setPub([]); setPages([]); return }
    const ids = (gm || []).map((x) => x.group_id)
    const [a, b, c, f] = await Promise.all([
      ids.length ? supabase.from('groups').select('*').in('id', ids).order('created_at', { ascending: false }) : { data: [] },
      supabase.from('groups').select('*').eq('privacy', 'public').order('created_at', { ascending: false }).limit(60),
      supabase.from('pages').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('page_follows').select('page_id').eq('user_id', user.id),
    ])
    setMine(a.data || []); setPub((b.data || []).filter((g) => !ids.includes(g.id))); setPages(c.data || [])
    setFollowing(new Set((f.data || []).map((x) => x.page_id)))
  }, [user.id])
  useEffect(() => { load() }, [load])

  const match = (s) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase())
  const list = tab === 'mine' ? mine : tab === 'discover' ? pub : pages
  const myPages = (pages || []).filter((p) => p.owner_id === user.id)

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="পেছনে" className="grid h-11 w-11 place-items-center rounded-2xl bg-surface"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-2xl font-extrabold">গ্রুপ ও পেজ</h2>
        <button onClick={() => setSheet(tab === 'pages' ? 'page' : 'group')} className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand to-coral px-4 py-2.5 text-sm font-bold text-inverse"><Plus size={18} />{tab === 'pages' ? 'নতুন পেজ' : 'নতুন গ্রুপ'}</button>
      </div>

      <div className="flex gap-2">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => setSp({ tab: t }, { replace: true })}
            className={`flex-1 rounded-full py-2.5 text-sm font-bold transition active:scale-95 ${tab === t ? 'bg-gradient-to-r from-brand to-coral text-inverse' : 'bg-surface text-fg/70 shadow-soft'}`}>{label}</button>
        ))}
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
        <input className="input !pl-11" placeholder="খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="rounded-2xl bg-surface p-4 text-sm text-danger">{err}</p>}

      {tab === 'pages' && myPages.length > 0 && !q && (
        <section className="space-y-2">
          <h3 className="px-1 text-sm font-bold text-fg/60">আমার পেজ</h3>
          {myPages.map((p) => <Row key={p.id} to={`/pages/${p.id}`} p={{ full_name: p.name, avatar_url: p.avatar_url }} title={p.name} sub={p.category} />)}
        </section>
      )}

      {list === null && <p className="py-8 text-center text-fg/50">লোড হচ্ছে…</p>}
      {list && tab === 'mine' && list.length === 0 && !err && <p className="py-10 text-center text-fg/60">আপনি এখনও কোনো গ্রুপে নেই। ওপরের বাটনে নতুন গ্রুপ খুলুন, অথবা "আবিষ্কার" থেকে যোগ দিন।</p>}
      {list && tab === 'discover' && list.length === 0 && !err && <p className="py-10 text-center text-fg/60">যোগ দেওয়ার মতো কোনো পাবলিক গ্রুপ নেই।</p>}

      {tab !== 'pages' && list?.filter((g) => match(g.name)).map((g) => (
        <Row key={g.id} to={`/groups/${g.id}`} p={{ full_name: g.name, avatar_url: g.avatar_url }} title={g.name}
          sub={g.about || (g.privacy === 'public' ? 'পাবলিক গ্রুপ' : 'প্রাইভেট গ্রুপ')}
          right={g.privacy === 'public' ? <Globe size={16} className="text-fg/40" /> : <Lock size={16} className="text-fg/40" />} />
      ))}
      {tab === 'pages' && list?.filter((p) => match(p.name)).map((p) => (
        <Row key={p.id} to={`/pages/${p.id}`} p={{ full_name: p.name, avatar_url: p.avatar_url }} title={p.name}
          sub={`${p.category || 'পেজ'}${p.about ? ' • ' + p.about : ''}`}
          right={following.has(p.id) ? <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">ফলো করছেন</span> : null} />
      ))}
      {tab === 'pages' && list?.length === 0 && !err && <p className="py-10 text-center text-fg/60">এখনও কোনো পেজ নেই। নিজের পেজ খুলে ফেলুন!</p>}

      {sheet === 'group' && <CreateGroupSheet onClose={() => setSheet(null)} />}
      {sheet === 'page' && <PageSheet onClose={() => setSheet(null)} onDone={load} />}
    </div>
  )
}
