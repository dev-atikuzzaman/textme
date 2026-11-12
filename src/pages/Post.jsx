import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SELECT_POST } from '../lib/constants'
import PostCard from '../components/PostCard'

export default function Post() {
  const { id } = useParams()
  const nav = useNavigate()
  const [post, setPost] = useState(undefined)
  const load = useCallback(async () => {
    const { data } = await supabase.from('posts').select(SELECT_POST).eq('id', id).maybeSingle()
    setPost(data)
  }, [id])
  useEffect(() => { load() }, [load])
  return (
    <div className="space-y-4 pt-2">
      <button onClick={() => nav(-1)} className="grid h-11 w-11 place-items-center rounded-2xl bg-white"><ArrowLeft size={20} /></button>
      {post === undefined && <p className="py-10 text-center text-ink/50">লোড হচ্ছে…</p>}
      {post === null && <p className="py-10 text-center text-ink/60">পোস্টটি পাওয়া যায়নি বা মুছে ফেলা হয়েছে।</p>}
      {post && <PostCard post={post} onChange={load} />}
    </div>
  )
}
