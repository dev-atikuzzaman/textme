import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { PRIVACY, fmt } from '../lib/constants'
import Avatar from './Avatar'

export default function PostCard({ post, onChange }) {
  const { user } = useAuth()
  const liked = post.likes?.some((l) => l.user_id === user.id)
  const P = PRIVACY.find((p) => p.id === post.privacy)
  const toggle = async () => {
    if (liked) await supabase.from('likes').delete().match({ post_id: post.id, user_id: user.id })
    else await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    onChange()
  }
  const del = async () => {
    if (!confirm('পোস্টটি মুছে ফেলবেন?')) return
    await supabase.from('posts').delete().eq('id', post.id); onChange()
  }
  return (
    <article className="space-y-3 rounded-[28px] bg-white p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <Link to={`/profile/${post.user_id}`}><Avatar p={post.profiles} /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{post.profiles?.full_name}</p>
          <p className="flex items-center gap-1 text-xs text-ink/50">{P && <P.Icon size={12} />}{fmt(post.created_at)}</p>
        </div>
        {post.user_id === user.id && <button onClick={del} className="text-ink/40"><Trash2 size={18} /></button>}
      </div>
      {post.title && <h3 className="font-bold">{post.title}</h3>}
      {post.content && <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>}
      {post.media_url && (post.media_type === 'video'
        ? <video src={post.media_url} controls playsInline preload="metadata" className="max-h-[480px] w-full rounded-2xl bg-black" />
        : <img src={post.media_url} alt="" loading="lazy" className="w-full rounded-2xl object-cover" />)}
      <button onClick={toggle} className={`flex items-center gap-1.5 text-sm font-semibold ${liked ? 'text-coral' : 'text-ink/60'}`}>
        <Heart size={20} fill={liked ? 'currentColor' : 'none'} />{post.likes?.length || 0}
      </button>
    </article>
  )
}
