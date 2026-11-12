import { useEffect, useState, useCallback } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { SELECT_POST } from '../lib/constants'
import PostCard from '../components/PostCard'
import UploadSheet from '../components/UploadSheet'
import Avatar from '../components/Avatar'

export default function Feed() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState(null)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    const { data } = await supabase.from('posts').select(SELECT_POST).eq('kind', 'post')
      .order('created_at', { ascending: false }).limit(50)
    setPosts(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-[28px] bg-white p-4 text-left shadow-soft">
        <Avatar p={profile} />
        <span className="flex-1 text-ink/50">মনে কী আছে{profile ? `, ${profile.full_name.split(' ')[0]}` : ''}?</span>
        <ImageIcon className="text-brand" />
      </button>
      {posts === null && <p className="py-10 text-center text-ink/50">লোড হচ্ছে…</p>}
      {posts?.length === 0 && <p className="py-10 text-center text-ink/60">এখনও কোনো পোস্ট নেই। প্রথম পোস্টটি আপনিই করুন, অথবা বন্ধুদের যোগ করুন।</p>}
      {posts?.map((p) => <PostCard key={p.id} post={p} onChange={load} />)}
      {open && <UploadSheet kind="post" onClose={() => setOpen(false)} onDone={load} />}
    </div>
  )
}
