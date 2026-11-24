import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, X } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { SELECT_POST } from '../lib/constants'
import PostCard from '../components/PostCard'
import PostSkeleton from '../components/PostSkeleton'
import Avatar from '../components/Avatar'
import PersonActions from '../components/PersonActions'
import { withContext } from '../lib/context'

export default function SearchPage() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const [people, setPeople] = useState([])
  const [posts, setPosts] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setQ(sp.get('q') || '') }, [sp])
  useEffect(() => {
    const t = q.replace(/[,()%*\\]/g, '').trim()
    if (!t) { setPeople([]); setPosts(null); return }
    let off = false
    setBusy(true)
    const id = setTimeout(async () => {
      const isTag = t.startsWith('#')
      const [pe, po] = await Promise.all([
        isTag ? { data: [] } : supabase.rpc('search_people', { q: t }),
        supabase.from('posts').select(SELECT_POST).eq('kind', 'post').ilike('content', `%${t}%`).order('created_at', { ascending: false }).limit(20),
      ])
      const rows = await withContext(po.data)
      if (off) return
      setPeople(pe.data || []); setPosts(rows); setBusy(false)
    }, 300)
    return () => { off = true; clearTimeout(id) }
  }, [q])

  const change = (v) => { setQ(v); setSp(v ? { q: v } : {}, { replace: true }) }
  const run = () => change(q)
  const empty = posts && !people.length && !posts.length

  return (
    <div className="space-y-4 pt-1">
      <div className="relative">
        <SearchIcon size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/65" />
        <input autoFocus className="input !pl-11 !pr-11" placeholder="নাম, ইউজারনেম, ইমেইল, ফোন বা #হ্যাশট্যাগ" value={q}
          onChange={(e) => change(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        {q && <button aria-label="মুছুন" onClick={() => change('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-fg/65"><X size={18} /></button>}
      </div>

      {!q.trim() && <p className="py-10 text-center text-fg/65">নাম, ইউজারনেম, পুরো ইমেইল বা ফোন নম্বর লিখে মানুষ খুঁজুন; পোস্ট বা #হ্যাশট্যাগও খুঁজতে পারবেন।</p>}
      {q.trim() && busy && !posts && <PostSkeleton />}
      {empty && !busy && <p className="py-10 text-center text-fg/65">কিছু পাওয়া যায়নি।</p>}

      {people.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-fg/65">মানুষ</h2>
          {people.map((p) => (
            <div key={p.id} className="rounded-3xl bg-surface p-3 shadow-soft">
              <Link to={`/profile/${p.id}`} className="flex items-center gap-3">
                <Avatar p={p} size={50} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.full_name}</p><p className="truncate text-xs text-fg/65">@{p.username}</p></div>
                {p.matched !== 'name' && <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">{p.matched === 'email' ? 'ইমেইল মিলেছে' : 'ফোন মিলেছে'}</span>}
              </Link>
              <div className="mt-3"><PersonActions p={p} /></div>
            </div>
          ))}
        </section>
      )}
      {posts?.length > 0 && (
        <section className="space-y-4">
          <h2 className="px-1 text-sm font-bold text-fg/65">পোস্ট</h2>
          {posts.map((p) => <PostCard key={p.id} post={p} onChange={run} />)}
        </section>
      )}
    </div>
  )
}
