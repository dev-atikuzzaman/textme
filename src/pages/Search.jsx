import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SELECT_POST } from '../lib/constants'
import PostCard from '../components/PostCard'
import PostSkeleton from '../components/PostSkeleton'
import Avatar from '../components/Avatar'

export default function SearchPage() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const [people, setPeople] = useState([])
  const [posts, setPosts] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setQ(sp.get('q') || '') }, [sp])
  useEffect(() => {
    const t = q.replace(/[,()%*_\\]/g, '').trim()
    if (!t) { setPeople([]); setPosts(null); return }
    let off = false
    setBusy(true)
    const id = setTimeout(async () => {
      const isTag = t.startsWith('#')
      const [pe, po] = await Promise.all([
        isTag ? { data: [] } : supabase.from('profiles').select('id,full_name,username,avatar_url').or(`username.ilike.%${t}%,full_name.ilike.%${t}%`).limit(8),
        supabase.from('posts').select(SELECT_POST).eq('kind', 'post').ilike('content', `%${t}%`).order('created_at', { ascending: false }).limit(20),
      ])
      if (off) return
      setPeople(pe.data || []); setPosts(po.data || []); setBusy(false)
    }, 300)
    return () => { off = true; clearTimeout(id) }
  }, [q])

  const change = (v) => { setQ(v); setSp(v ? { q: v } : {}, { replace: true }) }
  const run = () => change(q)
  const empty = posts && !people.length && !posts.length

  return (
    <div className="space-y-4 pt-1">
      <div className="relative">
        <SearchIcon size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg/40" />
        <input autoFocus className="input !pl-11 !pr-11" placeholder="মানুষ, পোস্ট বা #হ্যাশট্যাগ খুঁজুন" value={q}
          onChange={(e) => change(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        {q && <button aria-label="মুছুন" onClick={() => change('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-fg/50"><X size={18} /></button>}
      </div>

      {!q.trim() && <p className="py-10 text-center text-fg/50">কারো নাম, পোস্টের লেখা বা #হ্যাশট্যাগ লিখে খুঁজুন।</p>}
      {q.trim() && busy && !posts && <PostSkeleton />}
      {empty && !busy && <p className="py-10 text-center text-fg/60">কিছু পাওয়া যায়নি।</p>}

      {people.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-fg/60">মানুষ</h2>
          {people.map((p) => (
            <Link key={p.id} to={`/profile/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-soft">
              <Avatar p={p} /><div className="min-w-0"><p className="truncate font-bold">{p.full_name}</p><p className="truncate text-xs text-fg/50">@{p.username}</p></div>
            </Link>
          ))}
        </section>
      )}
      {posts?.length > 0 && (
        <section className="space-y-4">
          <h2 className="px-1 text-sm font-bold text-fg/60">পোস্ট</h2>
          {posts.map((p) => <PostCard key={p.id} post={p} onChange={run} />)}
        </section>
      )}
    </div>
  )
}
