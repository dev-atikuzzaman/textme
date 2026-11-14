import { useEffect, useState, useCallback, useRef } from 'react'
import { Image as ImageIcon, Video, Paperclip, LayoutGrid, Users, Bookmark, RefreshCw, ArrowUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useSaved } from '../context/Saved'
import { useFriends } from '../lib/useFriends'
import { SELECT_POST } from '../lib/constants'
import PostCard from '../components/PostCard'
import PostSkeleton from '../components/PostSkeleton'
import UploadSheet from '../components/UploadSheet'
import StoriesBar from '../components/home/StoriesBar'
import ActiveFriends from '../components/home/ActiveFriends'
import Avatar from '../components/Avatar'

const PAGE = 10
const FILTERS = [
  { id: 'all', label: 'সব', Icon: LayoutGrid },
  { id: 'friends', label: 'বন্ধুরা', Icon: Users },
  { id: 'image', label: 'ছবি', Icon: ImageIcon },
  { id: 'video', label: 'ভিডিও', Icon: Video },
  { id: 'saved', label: 'সেভ করা', Icon: Bookmark },
]
const EMPTY = {
  all: 'এখনও কোনো পোস্ট নেই। প্রথম পোস্টটি আপনিই করুন, অথবা বন্ধুদের যোগ করুন।',
  friends: 'বন্ধুদের কোনো পোস্ট এখনও নেই।',
  image: 'কোনো ছবির পোস্ট নেই।',
  video: 'কোনো ভিডিও পোস্ট নেই।',
  saved: 'কিছু সেভ করা নেই। পোস্টের ডানদিকের বুকমার্ক ট্যাপ করে সেভ করুন।',
}
const readHidden = () => { try { return JSON.parse(localStorage.getItem('apon-hidden') || '[]') } catch { return [] } }

export default function Feed() {
  const { user, profile } = useAuth()
  const saved = useSaved()
  const { friends, other } = useFriends()
  const [filter, setFilter] = useState('all')
  const [posts, setPosts] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [open, setOpen] = useState(null) // null | { accept }
  const [loadErr, setLoadErr] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [hidden, setHidden] = useState(readHidden)
  const [spin, setSpin] = useState(false)
  const sentinel = useRef()
  const busyMore = useRef(false)
  const countRef = useRef(0)
  const friendKey = friends.map(other).sort().join(',')
  const savedKey = [...saved.ids].sort().join(',')

  const build = useCallback((from, to) => {
    let q = supabase.from('posts').select(SELECT_POST).eq('kind', 'post')
    if (filter === 'image' || filter === 'video') q = q.eq('media_type', filter)
    if (filter === 'friends') q = q.in('user_id', [user.id, ...friendKey.split(',').filter(Boolean)])
    if (filter === 'saved') q = q.in('id', savedKey ? savedKey.split(',') : ['00000000-0000-0000-0000-000000000000'])
    if (filter === 'all') q = q.order('pinned_at', { ascending: false, nullsFirst: false })
    return q.order('created_at', { ascending: false }).range(from, to)
  }, [filter, friendKey, savedKey, user.id])

  // keep = এখন যতগুলো পোস্ট দেখাচ্ছে ততগুলোই রিফ্রেশ (স্ক্রলের জায়গা হারায় না)
  const load = useCallback(async ({ keep = false } = {}) => {
    const size = keep ? Math.max(PAGE, countRef.current) : PAGE
    const { data, error } = await build(0, size - 1)
    setLoadErr(error ? error.message : '')
    const rows = data || []
    countRef.current = rows.length
    setPosts(rows); setHasMore(rows.length === size); setNewCount(0)
  }, [build])

  const filterSig = filter + '|' + (filter === 'friends' ? friendKey : '') + '|' + (filter === 'saved' ? saved.ready : '')
  useEffect(() => { setPosts(null); countRef.current = 0; load() }, [filterSig]) // eslint-disable-line
  const reload = useCallback(() => load({ keep: true }), [load])

  const more = async () => {
    if (busyMore.current || !hasMore || !posts) return
    busyMore.current = true
    const { data } = await build(posts.length, posts.length + PAGE - 1)
    const rows = data || []
    setPosts((p) => { const ids = new Set(p.map((x) => x.id)); const n = [...p, ...rows.filter((x) => !ids.has(x.id))]; countRef.current = n.length; return n })
    setHasMore(rows.length === PAGE)
    busyMore.current = false
  }
  const moreRef = useRef(more); moreRef.current = more
  useEffect(() => {
    if (!sentinel.current) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && moreRef.current(), { rootMargin: '700px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [posts?.length, hasMore])

  // নতুন পোস্ট এসেছে কিনা (৪৫ সেকেন্ড পরপর, শুধু "সব" ট্যাবে)
  useEffect(() => {
    if (filter !== 'all') return
    const t = setInterval(async () => {
      if (document.hidden || !posts?.length) return
      const newest = posts.reduce((m, p) => (p.created_at > m ? p.created_at : m), '')
      const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true })
        .eq('kind', 'post').neq('user_id', user.id).gt('created_at', newest)
      setNewCount(count || 0)
    }, 45000)
    return () => clearInterval(t)
  }, [filter, posts, user.id])

  const refresh = useCallback(async () => {
    setSpin(true); window.scrollTo({ top: 0, behavior: 'smooth' })
    await load(); setSpin(false)
  }, [load])
  // নিচের "হোম" ট্যাবে আবার ট্যাপ করলে ওপরে গিয়ে রিফ্রেশ
  useEffect(() => {
    window.addEventListener('apon-home', refresh)
    return () => window.removeEventListener('apon-home', refresh)
  }, [refresh])

  const hide = (id) => {
    const n = [...new Set([...hidden, id])].slice(-300)
    setHidden(n)
    try { localStorage.setItem('apon-hidden', JSON.stringify(n)) } catch { /* ignore */ }
  }
  const shown = (posts || []).filter((p) => !hidden.includes(p.id) && (filter !== 'saved' || saved.ids.has(p.id)))
  const first = profile ? profile.full_name.split(' ')[0] : ''

  return (
    <div className="space-y-4">
      <StoriesBar />
      <ActiveFriends />

      <div className="rounded-[28px] bg-surface p-4 shadow-soft">
        <button onClick={() => setOpen({})} className="flex w-full items-center gap-3 text-left">
          <Avatar p={profile} />
          <span className="flex-1 text-fg/50">মনে কী আছে{first ? `, ${first}` : ''}?</span>
        </button>
        <div className="mt-3 flex border-t border-fg/5 pt-2">
          {[[ImageIcon, 'ছবি', 'image/*', 'text-brand'], [Video, 'ভিডিও', 'video/*', 'text-coral'], [Paperclip, 'ফাইল', undefined, 'text-sky-400']].map(([Icon, label, accept, color]) => (
            <button key={label} onClick={() => setOpen({ accept, autoPick: true })} className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 text-sm font-bold text-fg/70 transition active:scale-95">
              <Icon size={19} className={color} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1.5 py-2 text-[12.5px] font-bold transition active:scale-95 sm:gap-1.5 sm:text-sm max-[380px]:text-[11.5px] ${filter === id ? 'bg-gradient-to-r from-brand to-coral text-inverse' : 'bg-surface text-fg/70 shadow-soft'}`}>
            <Icon size={15} className="max-[400px]:hidden" />{label}
          </button>
        ))}
      </div>

      {newCount > 0 && (
        <button onClick={refresh} className="sticky top-[84px] z-20 mx-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-coral px-5 py-2.5 text-sm font-bold text-inverse shadow-2xl pop-in">
          <ArrowUp size={16} />{newCount.toLocaleString('bn-BD')}টি নতুন পোস্ট
        </button>
      )}
      {spin && <p className="flex items-center justify-center gap-2 text-sm text-fg/60"><RefreshCw size={15} className="animate-spin" />রিফ্রেশ হচ্ছে…</p>}

      {loadErr && <p className="rounded-2xl bg-surface p-4 text-sm text-danger">পোস্ট লোড করা যায়নি: {loadErr}</p>}
      {posts === null && <><PostSkeleton /><PostSkeleton /></>}
      {posts && shown.length === 0 && !loadErr && <p className="py-10 text-center text-fg/60">{EMPTY[filter]}</p>}
      {shown.map((p) => <PostCard key={p.id} post={p} onChange={reload} onHide={hide} />)}
      {hasMore && <div ref={sentinel}><PostSkeleton /></div>}
      {posts && !hasMore && shown.length > 5 && <p className="py-4 text-center text-sm text-fg/40">আপনি সব পোস্ট দেখে ফেলেছেন ✓</p>}

      {open && <UploadSheet kind="post" accept={open.accept} autoPick={open.autoPick} onClose={() => setOpen(null)} onDone={() => load()} />}
    </div>
  )
}
