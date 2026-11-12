import { useEffect, useRef, useState, useCallback } from 'react'
import { Heart, MessageCircle, Plus, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { CATEGORIES, SELECT_POST } from '../lib/constants'
import UploadSheet from '../components/UploadSheet'
import Avatar from '../components/Avatar'
import CommentsSheet from '../components/CommentsSheet'

function Reel({ post, muted, setMuted, onChange }) {
  const { user } = useAuth()
  const ref = useRef()
  const [showComments, setShowComments] = useState(false)
  const liked = post.likes?.some((l) => l.user_id === user.id)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? ref.current?.play().catch(() => {}) : ref.current?.pause()), { threshold: 0.7 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  const like = async () => {
    if (liked) await supabase.from('likes').delete().match({ post_id: post.id, user_id: user.id })
    else await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    onChange()
  }
  return (
    <section className="relative h-full snap-start">
      <video ref={ref} src={post.media_url} loop muted={muted} playsInline onClick={() => setMuted(!muted)} className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-28 right-4 flex flex-col items-center gap-5 text-white">
        <button onClick={like} className="flex flex-col items-center gap-1">
          <Heart size={32} fill={liked ? '#FF5C8A' : 'none'} stroke={liked ? '#FF5C8A' : 'white'} /><span className="text-sm font-semibold">{post.likes?.length || 0}</span>
        </button>
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
          <MessageCircle size={30} /><span className="text-sm font-semibold">{post.comments?.[0]?.count || 0}</span>
        </button>
        <button onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={28} /> : <Volume2 size={28} />}</button>
      </div>
      <div className="absolute bottom-28 left-4 right-20 space-y-2 text-white">
        <div className="flex items-center gap-2"><Avatar p={post.profiles} size={36} /><b>{post.profiles?.full_name}</b></div>
        {post.content && <p className="line-clamp-3 text-sm">{post.content}</p>}
        {post.category && <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{post.category}</span>}
      </div>
      {showComments && <CommentsSheet post={post} onClose={() => setShowComments(false)} onChange={onChange} />}
    </section>
  )
}

export default function Reels() {
  const [cat, setCat] = useState('সব')
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(true)
  const load = useCallback(async () => {
    let q = supabase.from('posts').select(SELECT_POST).eq('kind', 'reel').order('created_at', { ascending: false }).limit(30)
    if (cat !== 'সব') q = q.eq('category', cat)
    const { data } = await q
    setItems(data || [])
  }, [cat])
  useEffect(() => { load() }, [load])

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {['সব', ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c ? 'bg-white text-ink' : 'bg-white/20 text-white backdrop-blur'}`}>{c}</button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-coral text-white"><Plus /></button>
      </div>
      <div className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll">
        {items?.length === 0 && <p className="grid h-full place-items-center px-10 text-center text-white/70">এই বিষয়ে এখনও কোনো রিল নেই। + চেপে প্রথম রিলটি আপলোড করুন।</p>}
        {items?.map((p) => <Reel key={p.id} post={p} muted={muted} setMuted={setMuted} onChange={load} />)}
      </div>
      {open && <UploadSheet kind="reel" onClose={() => setOpen(false)} onDone={load} />}
    </div>
  )
}
