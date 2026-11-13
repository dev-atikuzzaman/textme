import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { LogOut, Camera, Eye, Trash2, ImagePlus, KeyRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { SELECT_POST } from '../lib/constants'
import { resizeSquare, mediaPathFromUrl } from '../lib/media'
import Avatar from '../components/Avatar'
import PostCard from '../components/PostCard'
import PasswordSheet from '../components/PasswordSheet'

export default function Profile() {
  const { id } = useParams()
  const { user, profile: me, refreshProfile } = useAuth()
  const uid = id || user.id
  const own = uid === user.id
  const [p, setP] = useState(own ? me : null)
  const [posts, setPosts] = useState([])
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ full_name: '', bio: '' })
  const [sheet, setSheet] = useState(null) // avatar | view | password
  const [busy, setBusy] = useState(false)
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

  const changeAvatar = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const blob = await resizeSquare(f)
      const path = `${user.id}/avatar-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
      const old = mediaPathFromUrl(p.avatar_url)
      const { error: e2 } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      if (e2) throw e2
      if (old) supabase.storage.from('media').remove([old])
      await refreshProfile(); await load(); setSheet(null)
    } catch (er) { alert(er.message) } finally { setBusy(false) }
  }

  const removeAvatar = async () => {
    if (!confirm('প্রোফাইল ছবি মুছে ফেলবেন?')) return
    setBusy(true)
    const old = mediaPathFromUrl(p.avatar_url)
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (error) alert(error.message)
    else { if (old) supabase.storage.from('media').remove([old]); await refreshProfile(); await load(); setSheet(null) }
    setBusy(false)
  }

  if (!p) return <p className="py-10 text-center text-ink/50">লোড হচ্ছে…</p>
  const Row = ({ onClick, Icon, children, danger }) => (
    <button onClick={onClick} disabled={busy} className={`flex w-full items-center gap-3 rounded-2xl bg-mist p-4 font-semibold disabled:opacity-50 ${danger ? 'text-coral' : ''}`}><Icon size={20} />{children}</button>
  )

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-[32px] bg-gradient-to-br from-brand to-coral p-6 text-center text-white shadow-soft">
        <button onClick={() => (own ? setSheet('avatar') : p.avatar_url && setSheet('view'))} className="relative mx-auto block w-fit">
          <Avatar p={p} size={96} />
          {own && <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-white text-brand"><Camera size={18} /></span>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={changeAvatar} />
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
        <div className="space-y-3">
          <div className="flex gap-3">
            <button onClick={() => setEdit(true)} className="btn-soft flex-1">প্রোফাইল এডিট</button>
            <button onClick={() => setSheet('password')} className="btn-soft flex-1"><KeyRound size={18} />পাসওয়ার্ড</button>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="btn-soft w-full !text-coral"><LogOut size={18} />লগ-আউট</button>
        </div>
      )}
      <h3 className="px-1 font-bold">পোস্ট ও ভিডিও</h3>
      {posts.length === 0 && <p className="py-6 text-center text-ink/60">দেখানোর মতো কিছু নেই।</p>}
      {posts.map((x) => <PostCard key={x.id} post={x} onChange={load} />)}

      {sheet === 'avatar' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 backdrop-blur-sm" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md space-y-2 rounded-t-[32px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">প্রোফাইল ছবি</h2>
              <button onClick={() => setSheet(null)} className="grid h-9 w-9 place-items-center rounded-full bg-mist"><X size={18} /></button>
            </div>
            {p.avatar_url && <Row Icon={Eye} onClick={() => setSheet('view')}>ছবি দেখুন</Row>}
            <Row Icon={ImagePlus} onClick={() => fileRef.current.click()}>{busy ? 'আপলোড হচ্ছে…' : p.avatar_url ? 'নতুন ছবি দিন' : 'ছবি যোগ করুন'}</Row>
            {p.avatar_url && <Row Icon={Trash2} danger onClick={removeAvatar}>ছবি মুছে ফেলুন</Row>}
          </div>
        </div>
      )}
      {sheet === 'view' && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4" onClick={() => setSheet(null)}><img src={p.avatar_url} alt="" className="max-h-full max-w-full rounded-3xl" /></div>}
      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}
    </div>
  )
}
