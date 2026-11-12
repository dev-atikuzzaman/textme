import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Plus, Heart, MessageCircle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { CATEGORIES, SELECT_POST, fmt } from '../lib/constants'
import UploadSheet from '../components/UploadSheet'
import Avatar from '../components/Avatar'
import CommentsSheet from '../components/CommentsSheet'

export default function Videos() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [cat, setCat] = useState('সব')
  const [items, setItems] = useState(null)
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [showComments, setShowComments] = useState(false)
  const load = useCallback(async () => {
    let q = supabase.from('posts').select(SELECT_POST).eq('kind', 'video').order('created_at', { ascending: false }).limit(40)
    if (cat !== 'সব') q = q.eq('category', cat)
    const { data } = await q
    setItems(data || [])
    setPlaying((p) => (p ? (data || []).find((x) => x.id === p.id) || null : null))
  }, [cat])
  useEffect(() => { load() }, [load])

  const like = async (post) => {
    const liked = post.likes?.some((l) => l.user_id === user.id)
    if (liked) await supabase.from('likes').delete().match({ post_id: post.id, user_id: user.id })
    else await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    load()
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white"><ArrowLeft size={20} /></button>
        <h2 className="flex-1 text-2xl font-extrabold">ভিডিও</h2>
        <button onClick={() => setOpen(true)} className="btn-primary !px-4 !py-2.5"><Plus size={18} />আপলোড</button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {['সব', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c ? 'bg-ink text-white' : 'bg-white'}`}>{c}</button>
        ))}
      </div>
      {items?.length === 0 && <p className="py-10 text-center text-ink/60">এই বিভাগে এখনও কোনো ভিডিও নেই।</p>}
      <div className="space-y-5">
        {items?.map((v) => (
          <button key={v.id} onClick={() => setPlaying(v)} className="block w-full text-left">
            <video src={`${v.media_url}#t=0.5`} preload="metadata" muted playsInline className="aspect-video w-full rounded-3xl bg-black object-cover" />
            <div className="mt-2 flex gap-3">
              <Avatar p={v.profiles} size={38} />
              <div className="min-w-0">
                <p className="truncate font-bold">{v.title}</p>
                <p className="text-xs text-ink/55">{v.profiles?.full_name} • {v.category} • {fmt(v.created_at)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {playing && (
        <div className="fixed inset-0 z-[55] overflow-y-auto bg-ink">
          <div className="mx-auto max-w-md">
            <button onClick={() => setPlaying(null)} className="m-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"><X size={20} /></button>
            <video src={playing.media_url} controls autoPlay playsInline className="w-full bg-black" />
            <div className="space-y-3 p-4 text-white">
              <h3 className="text-xl font-bold">{playing.title}</h3>
              <div className="flex items-center gap-3"><Avatar p={playing.profiles} size={36} /><b className="flex-1">{playing.profiles?.full_name}</b>
                <button onClick={() => like(playing)} className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2">
                  <Heart size={18} fill={playing.likes?.some((l) => l.user_id === user.id) ? '#FF5C8A' : 'none'} />{playing.likes?.length || 0}
                </button>
                <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2">
                  <MessageCircle size={18} />{playing.comments?.[0]?.count || 0}
                </button>
              </div>
              {playing.content && <p className="text-white/80">{playing.content}</p>}
            </div>
          </div>
        </div>
      )}
      {playing && showComments && <CommentsSheet post={playing} onClose={() => setShowComments(false)} onChange={load} />}
      {open && <UploadSheet kind="video" onClose={() => setOpen(false)} onDone={load} />}
    </div>
  )
}
