import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { LogOut, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { SELECT_POST } from '../lib/constants'
import Avatar from '../components/Avatar'
import PostCard from '../components/PostCard'

export default function Profile() {
  const { id } = useParams()
  const { user, profile: me, refreshProfile } = useAuth()
  const uid = id || user.id
  const own = uid === user.id
  const [p, setP] = useState(own ? me : null)
  const [posts, setPosts] = useState([])
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ full_name: '', bio: '' })
  const fileRef = useRef()

  const load = useCallback(async () => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setP(prof); setForm({ full_name: prof?.full_name || '', bio: prof?.bio || '' })
    const { data } = await supabase.from('posts').select(SELECT_POST).eq('user_id', uid).order('created_at', { ascending: false })
    setPosts(data || [])
  }, [uid])
  useEffect(() => { load() }, [load])

  const save = async () => {
    await supabase.from('profiles').update(form).eq('id', user.id)
    setEdit(false); await refreshProfile(); load()
  }
  const avatar = async (e) => {
    const f = e.target.files[0]; if (!f) return
    const path = `${user.id}/avatar-${Date.now()}`
    const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type })
    if (error) return alert(error.message)
    const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    await refreshProfile(); load()
  }

  if (!p) return <p className="py-10 text-center text-ink/50">লোড হচ্ছে…</p>
  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-[32px] bg-gradient-to-br from-brand to-coral p-6 text-center text-white shadow-soft">
        <div className="relative mx-auto w-fit">
          <Avatar p={p} size={96} />
          {own && <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={avatar} />
            <button onClick={() => fileRef.current.click()} className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-white text-brand"><Camera size={18} /></button>
          </>}
        </div>
        {edit ? (
          <div className="mt-4 space-y-2 text-ink">
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <textarea className="input" placeholder="নিজের সম্পর্কে লিখুন" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <button onClick={save} className="btn-soft w-full">সেভ করুন</button>
          </div>
        ) : (<>
          <h2 className="mt-3 text-2xl font-extrabold">{p.full_name}</h2>
          <p className="text-white/80">@{p.username}</p>
          {p.bio && <p className="mt-2 text-white/90">{p.bio}</p>}
        </>)}
      </div>
      {own && !edit && (
        <div className="flex gap-3">
          <button onClick={() => setEdit(true)} className="btn-soft flex-1">প্রোফাইল এডিট</button>
          <button onClick={() => supabase.auth.signOut()} className="btn-soft flex-1 !text-coral"><LogOut size={18} />লগ-আউট</button>
        </div>
      )}
      <h3 className="px-1 font-bold">পোস্ট ও ভিডিও</h3>
      {posts.length === 0 && <p className="py-6 text-center text-ink/60">দেখানোর মতো কিছু নেই।</p>}
      {posts.map((x) => <PostCard key={x.id} post={x} onChange={load} />)}
    </div>
  )
}
